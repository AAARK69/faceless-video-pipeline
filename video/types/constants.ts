import { z } from "zod";
export const COMP_NAME = "MyComp";

export const CompositionProps = z.object({
  topic: z.string(),
  items: z.array(z.object({
    name: z.string(),
    emoji: z.string(),
    color: z.string(),
    start: z.number(),
    end: z.number(),
    description: z.string()
  })),
  audioUrl: z.string(),
  words: z.array(z.object({
    word: z.string(),
    start: z.number(),
    end: z.number()
  }))
});

export const defaultMyCompProps: z.infer<typeof CompositionProps> = {
  topic: "Every Type of Humor Explained",
  items: [],
  audioUrl: "",
  words: []
};

export const DURATION_IN_FRAMES = 5400; // 3-minute default (can be updated dynamically)
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 30;
