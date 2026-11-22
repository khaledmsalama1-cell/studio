import { Composition, type CalculateMetadataFunction } from "remotion";
import { BrandVideo } from "./BrandVideo";
import { sceneTiming } from "./timing";
import type { Props } from "./types";

// Studio fallback when no --props are passed; real projects always pass their own.
const demo: Props = {
  project: {
    brand: {
      name: "Demo Brand",
      handle: "@demo",
      colors: { primary: "#1A1A1A", secondary: "#F2EDE4", accent: "#E4572E", background: "#FFFFFF", ink: "#111111", muted: "#6B6B6B" },
      fonts: { display: { family: "Inter", weight: 800 }, body: { family: "Inter", weight: 400 } },
    },
  },
  content: {
    width: 1080,
    height: 1920,
    scenes: [
      { type: "hook", text: "Pass a project with --props", duration: 2.5 },
      { type: "cta", text: "npm run render -- <project>", duration: 2.5 },
    ],
  },
  captions: null,
};

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
  const fps = props.content.fps ?? 30;
  return {
    fps,
    width: props.content.width,
    height: props.content.height,
    durationInFrames: Math.ceil(sceneTiming(props).total * fps),
  };
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Vertical"
      component={BrandVideo}
      defaultProps={demo}
      calculateMetadata={calculateMetadata}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={150}
    />
    <Composition
      id="Landscape"
      component={BrandVideo}
      defaultProps={{ ...demo, content: { ...demo.content, width: 1920, height: 1080 } }}
      calculateMetadata={calculateMetadata}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={150}
    />
  </>
);
