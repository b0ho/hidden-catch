import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StageSelect } from './pages/StageSelect';
import { Stage } from './pages/Stage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StageSelect />} />
        <Route path="/stage/:stageId" element={<Stage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
