# 히든캐치 백엔드 설계

리더보드(진행상황 동기화)와 수익화(`MONETIZATION_PLAN.md`)가 공통으로 필요로 하는 최소 백엔드를 하나로 설계한다. 원칙은 동일하다 — **복잡하지 않게 시작하되, 나중에 트래픽이 늘어도 갈아엎지 않고 확장할 수 있는 구조**로 잡는다.

## 스택

- **Express + TypeScript** — `tools/`에서 이미 쓰는 언어/컨벤션 그대로 재사용
- **better-sqlite3** — 파일 기반 DB, 별도 DB 서버 불필요. 동기 API라 코드가 단순해지고, 이 프로젝트 규모(캐주얼 게임, 동시접속 적음)에는 충분한 성능
- `shared/types.ts`를 서버·클라이언트가 계속 같이 참조 (지금 client가 `@shared/types`로 쓰는 것과 동일한 패턴을 server에도 적용)

## 디렉토리 구조

```
hidden-catch/
├── client/          (기존)
├── server/          (신규)
│   ├── src/
│   │   ├── index.ts            # Express 앱 진입점
│   │   ├── db.ts               # better-sqlite3 연결 + 스키마 마이그레이션
│   │   ├── routes/
│   │   │   ├── players.ts      # 익명 플레이어 등록/닉네임
│   │   │   ├── clears.ts       # 클리어 기록 제출 + 리더보드 조회
│   │   │   ├── purchases.ts    # 결제 체크아웃 + 웹훅
│   │   │   └── entitlements.ts # 잠금해제 상태 조회 (힌트/스킨/카테고리)
│   │   └── middleware/
│   │       └── playerId.ts     # 요청에서 플레이어 ID 추출/검증
│   ├── data/                   # SQLite 파일 저장 위치 (볼륨 마운트 지점)
│   ├── Dockerfile
│   ├── fly.toml
│   └── package.json
├── tools/           (기존)
└── shared/          (기존 — server도 참조)
```

## 데이터 모델

```sql
players (
  id TEXT PRIMARY KEY,          -- 클라이언트가 생성한 UUID
  nickname TEXT,
  created_at TEXT
)

clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT,
  stage_id TEXT,                -- 'hanok-01' 형식
  time_left INTEGER,
  created_at TEXT
)

purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT,
  product_id TEXT,               -- 'ad_free', 'hint_pack_5', 'skin_blue', 'category_diving-helmet' 등
  provider TEXT,                 -- 'tosspayments'
  provider_txn_id TEXT,
  amount INTEGER,
  created_at TEXT
)

entitlements (
  player_id TEXT,
  key TEXT,                      -- 'ad_free' | 'hint_balance' | 'skin:blue' | 'category:diving-helmet'
  value TEXT,                    -- 숫자/불리언은 문자열로 저장 (SQLite 특성)
  PRIMARY KEY (player_id, key)
)
```

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/players` | 플레이어 등록 (UUID 존재 확인/생성) |
| PATCH | `/api/players/:id` | 닉네임 설정 |
| POST | `/api/clears` | 클리어 기록 제출 `{ playerId, stageId, timeLeft }` |
| GET | `/api/leaderboard/:categoryId` | 카테고리별 상위 기록 |
| GET | `/api/progress/:playerId` | 기기 이동 시 진행상황 동기화 |
| GET | `/api/entitlements/:playerId` | 구매/잠금해제 상태 조회 |
| POST | `/api/purchases/checkout` | 토스페이먼츠 결제 세션 생성 |
| POST | `/api/purchases/webhook` | 결제 승인 웹훅 수신 → entitlements 반영 |

인증은 로그인 없이 **익명 UUID**로 시작한다 (localStorage에 생성해 저장, 요청마다 헤더로 전송). JWT 등 무거운 인증은 지금 단계에서 불필요 — 나중에 실제 로그인이 필요해지면 이 UUID에 계정을 연결하면 된다.

## 클라이언트 통합

- `client/src/lib/records.ts`를 확장해서 백엔드로 fetch하되, **실패 시 localStorage로 폴백**한다 — 백엔드가 배포 안 됐거나 오프라인이어도 게임 자체는 지금처럼 로컬 전용으로 동작해야 한다 (정적 사이트 배포 옵션을 잃지 않기 위함)
- `VITE_API_BASE_URL` 환경변수로 백엔드 주소 지정, 비어있으면 로컬 전용 모드로 자동 전환

## 배포 방식

### 추천: Fly.io

- **왜**: Node + SQLite + 영구 볼륨 조합에 가장 잘 맞는 PaaS로 널리 쓰이는 조합. `fly deploy` 한 번으로 Dockerfile 기반 배포, 무료 할당량으로 시작 가능, 도쿄(nrt) 리전으로 한국과 지연시간이 가깝다
- **확장 경로**: 트래픽이 늘면 머신 수를 늘리거나, 필요해지면 SQLite를 Postgres(Fly Postgres/Supabase)로 교체 — `db.ts`를 얇은 데이터 액세스 레이어로 분리해두면 라우트 코드를 안 건드리고 DB만 갈아끼울 수 있다
- 표준 Dockerfile 기반이라 나중에 다른 PaaS로 옮기고 싶어져도 이식이 쉽다 (특정 벤더에 강하게 종속되지 않음)

### 대안과 비교

| 옵션 | 장점 | 단점 |
|---|---|---|
| **Render** | GitHub 연동 자동배포 UI가 익숙함 | 무료 티어는 유휴 시 슬립(첫 요청 느림), 영구 디스크는 유료 플랜부터 — SQLite 영속성 확보하려면 사실상 처음부터 유료 |
| **Cloudflare Workers + D1** | 진짜 서버리스, 트래픽 없으면 비용 0에 가까움, 엣지 배포로 지연시간 우수 | `better-sqlite3`(네이티브 Node 애드온)가 Workers 런타임에서 동작 안 함 — D1 전용 클라이언트로 다시 짜야 해서 지금 설계와 궁합이 다름. 처음부터 D1으로 갈 계획이면 나쁘지 않지만, 재작업 비용 발생 |
| **국내 클라우드(네이버클라우드/카카오클라우드) / VPS** | 데이터 국내 보관, 결제 규제 대응에 유리할 수 있음 | 서버 설정·운영 부담이 PaaS보다 훨씬 큼 — 지금 단계의 "복잡하지 않게" 원칙과 안 맞음. 사업 규모가 커지면 그때 재검토 |

**결론**: Fly.io + Dockerfile + 볼륨 하나로 시작. 특정 클라우드에 깊이 종속되지 않는 표준 컨테이너 방식이라, 트래픽/매출이 커지면 그때 리전 추가나 DB 교체로 확장하면 된다.

## 로드맵

| 단계 | 내용 |
|---|---|
| Step 1 | `server/` 골격 + players/clears 테이블 + 리더보드 API |
| Step 2 | entitlements 테이블 + 토스페이먼츠 결제 플로우 (`MONETIZATION_PLAN.md` 2층) |
| Step 3 | 카테고리 유료화 API (`MONETIZATION_PLAN.md` 3층) |
| Step 4 | Fly.io 배포, 클라이언트에 `VITE_API_BASE_URL` 연결 |

## 주의사항

- 결제/광고 로직은 서버 검증이 전제이므로 Step 2·3은 Step 1 이후에만 의미가 있다
- SQLite 파일은 반드시 Fly.io 볼륨(영구 디스크)에 저장해야 한다 — 컨테이너 재시작 시 로컬 파일시스템은 초기화되므로 볼륨 마운트 없이 배포하면 데이터가 매번 날아간다
- CORS는 client 배포 도메인만 허용, 최소한의 rate limiting(`express-rate-limit`)으로 남용 방지
