export interface ParsedRecording {
  seriesTitle?: string;
  episodeTitle?: string;

  seasonNumber?: number;
  episodeNumber?: number;

  displayTitle: string;

  aufnahmeStart: Date;
  aufnahmeEnde: Date;
  sendungsStart: Date;
  sendungsEnde: Date;
  startOffset: number;
  endOffset: number;
  einschaltZeit: Date;
  ausschaltZeit: Date;
  graceAusschaltZeit: Date;
}

/* ------------------------------------------------------------------
   RECORD PARSER
------------------------------------------------------------------ */

export function parseRecording(rec: any, config: any): ParsedRecording | null {
  const meta = rec.Metadata;
  const media = meta?.Media?.[0];
  if (!meta || !media) return null;

  const begins = media.beginsAt * 1000;
  const ends = media.endsAt * 1000;

  const startOffset = Number(media.startOffsetSeconds ?? 0) * 1000;
  const endOffset = Number(media.endOffsetSeconds ?? 0) * 1000;

  const aufnahmeStart = new Date(begins - startOffset);
  const aufnahmeEnde = new Date(ends + endOffset);

  const sendungsStart = new Date(begins);
  const sendungsEnde = new Date(ends);

  const einschaltZeit = new Date(
    aufnahmeStart.getTime() - config.VORLAUF_AUFWACHEN_MIN * 60000
  );

  const ausschaltZeit = new Date(
    aufnahmeEnde.getTime() + config.AUSSCHALT_NACHLAUF_MIN * 60000
  );

  const graceAusschaltZeit = new Date(
    aufnahmeEnde.getTime() + ( config.AUSSCHALT_NACHLAUF_MIN + config.GRACE_PERIOD_MIN ) * 60000
  );

  // Plex Meta
  const seriesTitle = meta.grandparentTitle ?? meta.parentTitle;
  const episodeTitle = meta.type === "episode" ? meta.title : undefined;

  const seasonNumber =
    meta.parentIndex != null ? Number(meta.parentIndex) : undefined;

  const episodeNumber = meta.index != null ? Number(meta.index) : undefined;

  // S02E05 Format
  const seasonEpisode =
    seasonNumber != null && episodeNumber != null
      ? `S${String(seasonNumber).padStart(2, "0")}E${String(
          episodeNumber
        ).padStart(2, "0")}`
      : undefined;

  // DISPLAY TITLE (zentral & korrekt)
  let displayTitle =
    meta.title ??
    meta.grandparentTitle ??
    meta.parentTitle ??
    "Unbekannte Aufnahme";

  if (meta.type === "episode" && seriesTitle) {
    displayTitle = seasonEpisode
      ? episodeTitle
        ? `${seriesTitle} – ${seasonEpisode} – ${episodeTitle}`
        : `${seriesTitle} – ${seasonEpisode}`
      : episodeTitle
      ? `${seriesTitle} – ${episodeTitle}`
      : seriesTitle;
  }

  return {
    seriesTitle,
    episodeTitle,
    seasonNumber,
    episodeNumber,
    displayTitle,
    aufnahmeStart,
    aufnahmeEnde,
    sendungsStart,
    sendungsEnde,
    startOffset,
    endOffset,
    einschaltZeit,
    ausschaltZeit,
    graceAusschaltZeit,
  };
}
