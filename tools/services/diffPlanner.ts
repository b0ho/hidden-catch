import Anthropic from '@anthropic-ai/sdk';
import type { DiffEditType, DiffRegion } from '../../shared/types.js';

const EDIT_TYPES: DiffEditType[] = ['colorChange', 'objectRemove', 'resize', 'flip', 'duplicate'];

const SYSTEM_PROMPT =
  '당신은 "틀린그림찾기" 게임 스테이지를 설계하는 어시스턴트입니다. ' +
  '주어진 사진에서, 작은 영역만 픽셀 편집해도 자연스럽게 "다른 부분"이 될 수 있는 5곳을 고릅니다. ' +
  '영역은 서로 겹치지 않고 충분히 떨어져 있어야 하며, 너무 크지 않아야 합니다(전체 그림 인상이 바뀌면 안 됨).';

function validateRegion(raw: unknown): DiffRegion {
  const r = raw as Record<string, unknown>;
  const x = r.x;
  const y = r.y;
  const radius = r.radius;
  const editType = r.editType;
  if (
    typeof x !== 'number' || x < 0 || x > 1 ||
    typeof y !== 'number' || y < 0 || y > 1 ||
    typeof radius !== 'number' || radius <= 0 || radius > 0.2 ||
    typeof editType !== 'string' || !EDIT_TYPES.includes(editType as DiffEditType)
  ) {
    throw new Error(`유효하지 않은 diff 영역: ${JSON.stringify(raw)}`);
  }
  return { x, y, radius, editType: editType as DiffEditType };
}

export async function planDiffs(
  imageBuffer: Buffer,
  mediaType: 'image/jpeg' | 'image/png',
): Promise<DiffRegion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY가 설정되어 있지 않습니다. .env에 키를 추가하거나 --diffs-file로 수동 diff 좌표를 전달하세요.',
    );
  }

  const client = new Anthropic({ apiKey });
  const base64 = imageBuffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text:
              '이 이미지에서 편집 가능한 작고 명확한 영역 정확히 5개를 골라주세요. ' +
              '오직 JSON 배열만 응답하세요: ' +
              '[{"x": 0~1, "y": 0~1, "radius": 0.03~0.09, "editType": "colorChange"|"objectRemove"|"resize"|"flip"|"duplicate"}, ...]',
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude 응답에서 텍스트 블록을 찾을 수 없습니다.');
  }

  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Claude 응답에서 JSON 배열을 찾을 수 없습니다: ${textBlock.text}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as unknown[];
  if (!Array.isArray(parsed) || parsed.length !== 5) {
    throw new Error(`5개의 diff 영역이 필요하지만 ${Array.isArray(parsed) ? parsed.length : 0}개를 받았습니다.`);
  }

  return parsed.map(validateRegion);
}
