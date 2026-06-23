import { Composition } from "remotion";
import {
  COMP_NAME,
  defaultMyCompProps,
  defaultThumbnailProps,
  DURATION_IN_FRAMES,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_WIDTH,
  ThumbnailProps,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../../types/constants";
import { Main } from "./MyComp/Main";
import { NextLogo } from "./MyComp/NextLogo";
import { Thumbnail } from "./MyComp/Thumbnail";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMP_NAME}
        component={Main}
        durationInFrames={DURATION_IN_FRAMES}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultMyCompProps}
      />
      <Composition
        id="NextLogo"
        component={NextLogo}
        durationInFrames={300}
        fps={30}
        width={140}
        height={140}
        defaultProps={{
          outProgress: 0,
        }}
      />
      <Composition
        id="Thumbnail"
        component={Thumbnail}
        schema={ThumbnailProps}
        durationInFrames={1}
        fps={1}
        width={THUMBNAIL_WIDTH}
        height={THUMBNAIL_HEIGHT}
        defaultProps={defaultThumbnailProps}
      />
    </>
  );
};
