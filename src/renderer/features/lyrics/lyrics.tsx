import { useCallback, useEffect, useRef, useState } from 'react';
import { Center, Group } from '@mantine/core';
import isElectron from 'is-electron';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '/@/renderer/features/action-required';
import { getServerById, useCurrentSong } from '/@/renderer/store';
import { UnsynchronizedLyrics } from '/@/renderer/features/lyrics/unsynchronized-lyrics';
import { RiInformationFill } from 'react-icons/ri';
import { TextTitle } from '/@/renderer/components';
import {
  InternetProviderLyricResponse,
  LyricOverride,
  LyricsResponse,
  SynchronizedLyricsArray,
} from '/@/renderer/api/types';
import { useSongLyrics } from '/@/renderer/features/lyrics/queries/lyric-query';
import { SynchronizedLyrics } from './synchronized-lyrics';

const lyrics = isElectron() ? window.electron.lyrics : null;

const ipc = isElectron() ? window.electron.ipc : null;

// use by https://github.com/ustbhuangyi/lyric-parser
const timeExp = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?]([^\n]+)\n/g;

export const Lyrics = () => {
  const currentSong = useCurrentSong();
  const currentServer = getServerById(currentSong?.serverId);

  const [overrideLyrics, setOverrideLyrics] = useState<string | null>(null);
  const [overrideData, setOverrideData] = useState<LyricOverride | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [songLyrics, setSongLyrics] = useState<LyricsResponse | null>(null);

  const remoteLyrics = useSongLyrics({
    options: { enabled: !!currentSong },
    query: { songId: currentSong?.id ?? '' },
    serverId: currentServer?.id,
  });

  const songRef = useRef<string | null>(null);

  useEffect(() => {
    lyrics?.remoteLyricsListener(
      (
        _event: any,
        songName: string,
        lyricSource: string,
        lyric: InternetProviderLyricResponse,
      ) => {
        if (songName === songRef.current) {
          const { lyrics, ...rest } = lyric;
          setSource(lyricSource);

          setOverrideData(rest);
          setOverrideLyrics(lyrics);
        }
      },
    );

    return () => {
      ipc?.removeAllListeners('lyric-get');
    };
  }, []);

  useEffect(() => {
    const hasTaggedLyrics = currentSong && currentSong.lyrics;
    const hasLyricsResponse =
      !remoteLyrics.isLoading && remoteLyrics?.isSuccess && remoteLyrics?.data !== null;

    if (!hasTaggedLyrics && !hasLyricsResponse) {
      lyrics?.fetchRemoteLyrics(currentSong);
    }

    songRef.current = currentSong?.name ?? null;

    setOverrideData(null);
    setOverrideLyrics(null);
    setSource(null);
  }, [currentSong, remoteLyrics.isLoading, remoteLyrics?.data, remoteLyrics?.isSuccess]);

  useEffect(() => {
    let lyrics: string | null = null;

    if (currentSong?.lyrics) {
      lyrics = currentSong.lyrics;

      setSource(currentServer?.name ?? 'music server');
    } else if (overrideLyrics) {
      lyrics = overrideLyrics;
    } else if (remoteLyrics.data) {
      setSource(currentServer?.name ?? 'music server');
      setSongLyrics(remoteLyrics.data);
      return;
    }

    if (lyrics) {
      const synchronizedLines = lyrics.matchAll(timeExp);

      const synchronizedTimes: SynchronizedLyricsArray = [];

      for (const line of synchronizedLines) {
        const [, minute, sec, ms, text] = line;
        const minutes = parseInt(minute, 10);
        const seconds = parseInt(sec, 10);
        const milis = ms?.length === 3 ? parseInt(ms, 10) : parseInt(ms, 10) * 10;

        const timeInMilis = (minutes * 60 + seconds) * 1000 + milis;
        synchronizedTimes.push([timeInMilis, text]);
      }

      if (synchronizedTimes.length === 0) {
        setSongLyrics(lyrics);
      } else {
        setSongLyrics(synchronizedTimes);
      }
    } else {
      setSongLyrics(null);
    }
  }, [currentServer?.name, currentSong, overrideLyrics, remoteLyrics.data]);

  const clearOverride = useCallback(() => {
    setOverrideData(null);
    setOverrideLyrics(null);
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {!songLyrics ? (
        <Center p="2rem">
          <Group>
            <RiInformationFill size="2rem" />
            <TextTitle
              order={3}
              weight={700}
            >
              No lyrics found
            </TextTitle>
          </Group>
        </Center>
      ) : (
        <>
          {Array.isArray(songLyrics) ? (
            <SynchronizedLyrics
              lyrics={songLyrics}
              override={overrideData}
              source={source}
              onRemoveLyric={clearOverride}
            />
          ) : (
            <UnsynchronizedLyrics
              lyrics={songLyrics}
              override={overrideData}
              source={source}
              onRemoveLyric={clearOverride}
            />
          )}
        </>
      )}
    </ErrorBoundary>
  );
};
