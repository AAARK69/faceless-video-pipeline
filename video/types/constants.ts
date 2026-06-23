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

export const DURATION_IN_FRAMES = 20000; // 11-minute default (can be updated dynamically)
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 30;

export const THUMBNAIL_WIDTH = 1280;
export const THUMBNAIL_HEIGHT = 720;

export const ThumbnailProps = z.object({
  topic: z.string(),
  emoji: z.string(),
  accentColor: z.string(),
  conceptNames: z.array(z.string()),
});

export const defaultThumbnailProps: z.infer<typeof ThumbnailProps> = {
  topic: "Every Type of Humor Explained",
  emoji: "😂",
  accentColor: "#6b21a8",
  conceptNames: ["Sarcasm", "Irony", "Slapstick", "Satire"],
};
