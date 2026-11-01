import { useEvent } from 'expo';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, View } from 'react-native';
import { Empty, Txt } from '@/components/ui';
import { space, usePalette } from '@/lib/theme';

/** Review playback inside the app: useful to rewatch a passage, it does not count as attendance. */
export default function Review() {
  const c = usePalette();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }} testID="review">
      <Stack.Screen options={{ title: title ?? 'Ripasso video' }} />
      {status === 'error' ? (
        <Empty
          icon="video-off-outline"
          title="Video non disponibile"
          body={
            error?.message
              ? 'Il server non ha restituito il video. Prova a guardarlo dal player ufficiale.'
              : undefined
          }
        />
      ) : (
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          allowsPictureInPicture={false}
          contentFit="contain"
        />
      )}
      <View style={{ padding: space.lg }}>
        <Txt variant="small" color="textMuted">
          Ripasso nell’app: questa riproduzione non viene registrata come frequenza.
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
});
