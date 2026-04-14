import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ComparePage } from "./pages/ComparePage";
import { UploadPage } from "./pages/UploadPage";
import { VisualizePage } from "./pages/VisualizePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/visualize/:id" element={<VisualizePage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
    </BrowserRouter>
  );
}
