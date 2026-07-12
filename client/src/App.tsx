import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CategorySelect } from './pages/CategorySelect';
import { StageList } from './pages/StageList';
import { Stage } from './pages/Stage';
import { NotFound } from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CategorySelect />} />
        <Route path="/category/:categoryId" element={<StageList />} />
        <Route path="/stage/:categoryId/:order" element={<Stage />} />
        <Route path="*" element={<NotFound message="존재하지 않는 페이지입니다." />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
