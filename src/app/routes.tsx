import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { Profile } from "./components/Profile";
import { SpotifyIntegration } from "./components/SpotifyIntegration";
import { TestMode } from "./components/TestMode";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "settings", Component: Settings },
      { path: "profile", Component: Profile },
      { path: "spotify", Component: SpotifyIntegration },
      { path: "spotify/callback", Component: SpotifyIntegration },
      { path: "test", Component: TestMode },
    ],
  },
]);
