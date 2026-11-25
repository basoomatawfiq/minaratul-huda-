import type { ContentItem } from '../../types/content';

export interface ContentActionCapabilities {
  canPlayAudio: boolean;
  canDownloadAudio: boolean;
  canReadTranscript: boolean;
  canReadDocument: boolean;
  canRead: boolean;
  canDownloadDocument: boolean;
}

export function getContentActions(item: ContentItem): ContentActionCapabilities {
  const canPlayAudio = Boolean(item.audio?.url);
  const canDownloadAudio = Boolean(item.audio?.url);
  const canReadTranscript = Boolean(
    item.transcript?.en?.trim() || item.transcript?.ar?.trim() || item.transcript?.lg?.trim()
  );
  const canReadDocument = Boolean(item.document?.url);
  const canRead = canReadTranscript || canReadDocument;
  const canDownloadDocument = Boolean(item.document?.url);

  return {
    canPlayAudio,
    canDownloadAudio,
    canReadTranscript,
    canReadDocument,
    canRead,
    canDownloadDocument,
  };
}
