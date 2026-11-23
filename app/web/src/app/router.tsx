import { createBrowserRouter } from "react-router";
import { Layout } from "./Layout";
import { HomePage } from "@/features/home";
import { BrandsPage, BrandDetailPage } from "@/features/brands";
import { ProjectsPage, ProjectDetailPage } from "@/features/projects";
import { LibraryPage } from "@/features/library";
import { AppsPage } from "@/features/apps";
import { ResearchPage, ResearchDetailPage } from "@/features/research";
import { ChatPage } from "@/features/agents";
import { JobsPage } from "@/features/jobs";
import { SettingsPage } from "@/features/settings";

// One route per page; every page lives in its feature folder
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/brands", element: <BrandsPage /> },
      { path: "/brands/:slug", element: <BrandDetailPage /> },
      { path: "/projects", element: <ProjectsPage /> },
      { path: "/projects/:brand/:id", element: <ProjectDetailPage /> },
      { path: "/library", element: <LibraryPage /> },
      { path: "/apps", element: <AppsPage /> },
      { path: "/research", element: <ResearchPage /> },
      { path: "/research/:brand/:key", element: <ResearchDetailPage /> },
      { path: "/claude", element: <ChatPage /> },
      { path: "/jobs", element: <JobsPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "*", element: <p className="text-ink-2">This page doesn't exist. Use the menu to find your way back.</p> },
    ],
  },
]);
