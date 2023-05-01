import { forwardRef, Fragment, Ref, MouseEvent } from 'react';
import { Group, Rating, Stack } from '@mantine/core';
import { useParams } from 'react-router';
import { LibraryItem, ServerType } from '/@/renderer/api/types';
import { Text } from '/@/renderer/components';
import { useAlbumArtistDetail } from '/@/renderer/features/artists/queries/album-artist-detail-query';
import { LibraryHeader, useSetRating } from '/@/renderer/features/shared';
import { useContainerQuery } from '/@/renderer/hooks';
import { AppRoute } from '/@/renderer/router/routes';
import { formatDurationString } from '/@/renderer/utils';
import { useCurrentServer } from '../../../store/auth.store';

interface AlbumArtistDetailHeaderProps {
  background: string;
}

export const AlbumArtistDetailHeader = forwardRef(
  ({ background }: AlbumArtistDetailHeaderProps, ref: Ref<HTMLDivElement>) => {
    const { albumArtistId } = useParams() as { albumArtistId: string };
    const server = useCurrentServer();
    const detailQuery = useAlbumArtistDetail({
      query: { id: albumArtistId },
      serverId: server?.id,
    });
    const cq = useContainerQuery();

    const metadataItems = [
      {
        id: 'albumCount',
        secondary: false,
        value: detailQuery?.data?.albumCount && `${detailQuery?.data?.albumCount} albums`,
      },
      {
        id: 'songCount',
        secondary: false,
        value: detailQuery?.data?.songCount && `${detailQuery?.data?.songCount} songs`,
      },
      {
        id: 'duration',
        secondary: true,
        value: detailQuery?.data?.duration && formatDurationString(detailQuery.data.duration),
      },
    ];

    const updateRatingMutation = useSetRating({});

    const handleUpdateRating = (rating: number) => {
      if (!detailQuery?.data) return;

      updateRatingMutation.mutate({
        query: {
          item: [detailQuery.data],
          rating,
        },
        serverId: detailQuery?.data.serverId,
      });
    };

    const handleClearRating = (_e: MouseEvent<HTMLDivElement>, rating?: number) => {
      if (!detailQuery?.data || !detailQuery?.data.userRating) return;

      const isSameRatingAsPrevious = rating === detailQuery.data.userRating;
      if (!isSameRatingAsPrevious) return;

      updateRatingMutation.mutate({
        query: {
          item: [detailQuery.data],
          rating: 0,
        },
        serverId: detailQuery.data.serverId,
      });
    };

    const showRating = detailQuery?.data?.serverType === ServerType.NAVIDROME;

    return (
      <Stack ref={cq.ref}>
        <LibraryHeader
          ref={ref}
          background={background}
          imageUrl={detailQuery?.data?.imageUrl}
          item={{ route: AppRoute.LIBRARY_ALBUM_ARTISTS, type: LibraryItem.ALBUM_ARTIST }}
          title={detailQuery?.data?.name || ''}
        >
          <Stack>
            <Group>
              {metadataItems
                .filter((i) => i.value)
                .map((item, index) => (
                  <Fragment key={`item-${item.id}-${index}`}>
                    {index > 0 && <Text $noSelect>•</Text>}
                    <Text $secondary={item.secondary}>{item.value}</Text>
                  </Fragment>
                ))}
              {showRating && (
                <>
                  <Text $noSelect>•</Text>
                  <Rating
                    readOnly={detailQuery?.isFetching || updateRatingMutation.isLoading}
                    value={detailQuery?.data?.userRating || 0}
                    onChange={handleUpdateRating}
                    onClick={handleClearRating}
                  />
                </>
              )}
            </Group>
            <Group
              sx={{
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                display: '-webkit-box',
                overflow: 'hidden',
              }}
            />
          </Stack>
        </LibraryHeader>
      </Stack>
    );
  },
);
