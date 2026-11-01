import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { SaveProvider } from "./save/SaveProvider";
import { Boot } from "./routes/Boot";
import { Boss } from "./routes/Boss";
import { Checkpoint } from "./routes/Checkpoint";
import { Lesson } from "./routes/Lesson";
import { Mission } from "./routes/Mission";
import { Settings } from "./routes/Settings";
import { StationMap } from "./routes/StationMap";
import { Vault } from "./routes/Vault";
import { Warmup } from "./routes/Warmup";

// HashRouter: GitHub Pages has no server-side rewrites, so deep links must live after the #.
export function App() {
  return (
    <SaveProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Boot />} />
            <Route path="map" element={<StationMap />} />
            <Route path="mission/:missionId" element={<Mission />} />
            <Route path="mission/:missionId/lesson/:lessonNumber" element={<Lesson />} />
            <Route path="mission/:missionId/boss/:bossNumber" element={<Boss />} />
            <Route path="mission/:missionId/checkpoint" element={<Checkpoint />} />
            <Route path="mission/:missionId/warmup" element={<Warmup />} />
            <Route path="vault" element={<Vault />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </SaveProvider>
  );
}
