import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CategorySelect } from './pages/CategorySelect';
import { StageList } from './pages/StageList';
import { Stage } from './pages/Stage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CategorySelect />} />
        <Route path="/category/:categoryId" element={<StageList />} />
        <Route path="/stage/:categoryId/:order" element={<Stage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
