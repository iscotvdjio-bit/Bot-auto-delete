import type { Message, Attachment } from "discord.js";
import {
  IMAGE_CONTENT_TYPE_PREFIX,
  IMAGE_EXTENSIONS,
  URL_REGEX,
} from "./constants.js";

export type ViolationReason = "link" | "image" | "attachment";

function attachmentIsImage(att: Attachment): boolean {
  if (att.contentType?.startsWith(IMAGE_CONTENT_TYPE_PREFIX)) return true;
  if (att.width && att.height) return true;
  const name = (att.name ?? "").toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = name.slice(dot + 1);
  return IMAGE_EXTENSIONS.has(ext);
}

export interface ScanRules {
  deleteLinks: boolean;
  deleteImages: boolean;
  deleteAttachments: boolean;
}

export function scanMessage(
  message: Message,
  rules: ScanRules,
): ViolationReason[] {
  const reasons = new Set<ViolationReason>();

  if (rules.deleteLinks) {
    const content = message.content ?? "";
    if (content.length > 0) {
      URL_REGEX.lastIndex = 0;
      if (URL_REGEX.test(content)) reasons.add("link");
    }
    if (message.embeds.length > 0) {
      for (const embed of message.embeds) {
        if (embed.url || embed.image?.url || embed.video?.url) {
          reasons.add("link");
          break;
        }
      }
    }
  }

  if (message.attachments.size > 0) {
    let hasImage = false;
    let hasOther = false;
    for (const att of message.attachments.values()) {
      if (attachmentIsImage(att)) hasImage = true;
      else hasOther = true;
    }
    if (rules.deleteImages && hasImage) reasons.add("image");
    if (rules.deleteAttachments && hasOther) reasons.add("attachment");
  }

  if (rules.deleteImages && message.stickers.size > 0) {
    reasons.add("image");
  }

  return Array.from(reasons);
}
