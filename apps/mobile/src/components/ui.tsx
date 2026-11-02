import { MaterialCommunityIcons } from '@expo/vector-icons';
import { errorCode, formatError, highlight } from '@studium/core';
import { Children, type ComponentProps, Fragment, type ReactNode, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { haptics } from '@/lib/haptics';
import { elevation, type Palette, radius, space, touch, type, usePalette } from '@/lib/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// ------------------------------------------------------------------ text

type Variant = keyof typeof type;

export function Txt({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: keyof Palette }) {
  const c = usePalette();
  return <Text {...rest} style={[type[variant], { color: c[color ?? 'text'] }, style]} />;
}

/** The app's signature: a highlighter swipe behind a key figure. */
export function Marked({ children, variant = 'display' }: { children: ReactNode; variant?: Variant }) {
  const c = usePalette();
  return (
    <View style={styles.markedWrap}>
      <View style={[styles.marker, { backgroundColor: c.highlight }]} />
      <Txt variant={variant} style={{ color: c.onHighlight }}>
        {children}
      </Txt>
    </View>
  );
}

/** Text with the query terms marked by the highlighter. Keys are character offsets, so they are stable. */
export function Highlighted({
  text,
  query,
  style,
  numberOfLines,
  selectable,
}: {
  text: string;
  query: string;
  style?: TextProps['style'];
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const c = usePalette();
  let offset = 0;
  return (
    <Text style={style} numberOfLines={numberOfLines} selectable={selectable}>
      {highlight(text, query).map((seg) => {
        const key = offset;
        offset += seg.text.length;
        return seg.match ? (
          <Text key={key} style={{ backgroundColor: c.highlight, color: c.onHighlight }}>
            {seg.text}
          </Text>
        ) : (
          <Text key={key}>{seg.text}</Text>
        );
      })}
    </Text>
  );
}

/** Splits text into paragraphs keyed by their offset in the source. */
export const paragraphs = (text: string, sep: RegExp = /\n+/): { key: number; text: string }[] => {
  const out: { key: number; text: string }[] = [];
  let offset = 0;
  for (const part of text.split(sep)) {
    if (part.trim()) out.push({ key: offset, text: part });
    offset += part.length + 1;
  }
  return out;
};

// ------------------------------------------------------------------ layout

export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  ...rest
}: ScrollViewProps & { refreshing?: boolean; onRefresh?: () => void; contentStyle?: ViewStyle }) {
  const c = usePalette();
  return (
    <ScrollView
      {...rest}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ padding: space.lg, paddingBottom: 96, gap: space.xl }, contentStyle]}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            colors={[c.ink]}
            progressBackgroundColor={c.surface}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      {title || action ? (
        <View style={styles.sectionHead}>
          {title ? (
            <Txt variant="heading" accessibilityRole="header">
              {title}
            </Txt>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** A raised surface with a hairline border and a soft shadow: the base container of the app. */
export function Card({
  children,
  style,
  testID,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
  tone?: 'surface' | 'ink';
}) {
  const c = usePalette();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: tone === 'ink' ? c.inkSoft : c.surface, borderColor: c.border },
        elevation(c, tone === 'ink' ? 0 : 1),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** An inline message with an icon: information, a warning to read before acting, or an error. */
export function Callout({
  tone = 'info',
  title,
  children,
  testID,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  children?: ReactNode;
  testID?: string;
}) {
  const c = usePalette();
  const looks: Record<typeof tone, { bg: string; fg: string; icon: IconName }> = {
    info: { bg: c.inkSoft, fg: c.ink, icon: 'information-outline' },
    warning: { bg: c.highlight, fg: c.onHighlight, icon: 'alert-outline' },
    danger: { bg: c.dangerSoft, fg: c.danger, icon: 'shield-alert-outline' },
    success: { bg: c.successSoft, fg: c.success, icon: 'check-circle-outline' },
  };
  const look = looks[tone];
  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[styles.callout, { backgroundColor: look.bg }]}
    >
      <MaterialCommunityIcons name={look.icon} size={20} color={look.fg} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={[type.smallStrong, { color: look.fg }]}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

/** A surface holding rows separated by hairlines. */
export function Group({ children }: { children: ReactNode }) {
  const c = usePalette();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }, elevation(c, 1)]}>
      {items.map((child, i) => (
        <Fragment key={(child as { key?: string }).key ?? i}>
          {i > 0 ? <View style={[styles.sep, { backgroundColor: c.border }]} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  icon,
  iconColor,
  right,
  onPress,
  chevron = !!onPress,
  testID,
  disabled,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string | null;
  icon?: IconName;
  iconColor?: keyof Palette;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  testID?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const c = usePalette();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      android_ripple={onPress ? { color: c.inkSoft } : undefined}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: c.surfaceAlt },
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon} size={22} color={c[iconColor ?? 'ink']} style={styles.rowIcon} />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong" numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" color="textMuted" numberOfLines={3}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
      {chevron ? <MaterialCommunityIcons name="chevron-right" size={22} color={c.textMuted} /> : null}
    </Pressable>
  );
}

export function Progress({
  value,
  tone = 'ink',
  height = 6,
}: {
  value: number;
  tone?: 'ink' | 'success';
  height?: number;
}) {
  const c = usePalette();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height, borderRadius: height, backgroundColor: c.track, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%`, height, borderRadius: height, backgroundColor: c[tone] }} />
    </View>
  );
}

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  /** `highlight` is the app's signature: the one thing that needs attention now. */
  tone?: 'neutral' | 'success' | 'danger' | 'ink' | 'highlight';
}) {
  const c = usePalette();
  const bg = {
    neutral: c.surfaceAlt,
    success: c.successSoft,
    danger: c.dangerSoft,
    ink: c.inkSoft,
    highlight: c.highlight,
  }[tone];
  const fg = {
    neutral: c.textMuted,
    success: c.success,
    danger: c.danger,
    ink: c.ink,
    highlight: c.onHighlight,
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[type.caption, { color: fg, fontFamily: 'Figtree_500Medium' }]}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  icon,
  kind = 'primary',
  busy,
  testID,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  kind?: 'primary' | 'secondary' | 'quiet' | 'danger';
  /** Work in progress: shows a spinner, ignores presses, announces "busy" to screen readers. */
  busy?: boolean;
  testID?: string;
  disabled?: boolean;
}) {
  const c = usePalette();
  const inactive = !!disabled && !busy;
  const solid = kind === 'primary' || kind === 'danger';
  const bg = inactive
    ? kind === 'quiet'
      ? 'transparent'
      : c.surfaceAlt
    : { primary: c.ink, danger: c.danger, secondary: c.inkSoft, quiet: 'transparent' }[kind];
  const fg = inactive ? c.textMuted : solid ? (kind === 'danger' ? c.surface : c.onInk) : c.ink;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (solid) haptics.tap();
        onPress();
      }}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
      android_ripple={{ color: solid ? '#ffffff33' : c.inkSoft }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        solid && !inactive && elevation(c, 1),
        pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
        kind === 'quiet' && { paddingHorizontal: space.sm },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : icon ? (
        <MaterialCommunityIcons name={icon} size={20} color={fg} />
      ) : null}
      <Text style={[type.bodyStrong, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// ------------------------------------------------------------------ states

/** A pulsing placeholder with the shape of the content that is loading. Static when "reduce motion" is on. */
export function Skeleton({
  width = '100%',
  height = 16,
  round = false,
}: {
  width?: number | `${number}%`;
  height?: number;
  round?: boolean;
}) {
  const c = usePalette();
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse]);
  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: round ? height / 2 : radius.sm,
        backgroundColor: c.track,
        opacity: pulse,
      }}
    />
  );
}

/** Loading state: skeleton rows in the shape of a list, with the label announced to screen readers. */
export function Loading({ label = 'Caricamento…' }: { label?: string }) {
  const c = usePalette();
  return (
    <View
      style={{ gap: space.lg, paddingVertical: space.sm }}
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      testID="loading"
    >
      <Skeleton width="45%" height={24} />
      <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.row, { gap: space.md }]}>
            <Skeleton width={24} height={24} round />
            <View style={{ flex: 1, gap: space.sm }}>
              <Skeleton width={i === 1 ? '60%' : '80%'} />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
        ))}
      </View>
      <Txt variant="small" color="textMuted" style={{ textAlign: 'center' }}>
        {label}
      </Txt>
    </View>
  );
}

/** Icon on a soft round badge, used by the full-screen states. */
function StateIcon({ name, tone }: { name: IconName; tone: 'muted' | 'danger' }) {
  const c = usePalette();
  return (
    <View style={[styles.stateIcon, { backgroundColor: tone === 'danger' ? c.dangerSoft : c.surfaceAlt }]}>
      <MaterialCommunityIcons name={name} size={32} color={tone === 'danger' ? c.danger : c.textMuted} />
    </View>
  );
}

const MESSAGES: Record<string, string> = {
  NETWORK: 'Nessuna connessione o la piattaforma non risponde. Riprova quando sei online.',
  SESSION_EXPIRED: 'La sessione è scaduta. Accedi di nuovo per aggiornare i dati.',
  PLATFORM_CHANGED: 'La piattaforma ha cambiato il formato dei dati. Aggiorna l’app o segnala il problema.',
  NOT_FOUND: 'Questo contenuto non esiste più sulla piattaforma.',
  HTTP_ERROR: 'La piattaforma ha risposto con un errore. Riprova tra poco.',
};

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const code = errorCode(error);
  // One haptic cue when the error state appears (not on every re-render).
  useEffect(() => {
    haptics.error();
  }, []);
  return (
    <View style={styles.center} testID="error-state" accessibilityLiveRegion="assertive">
      <StateIcon name={code === 'NETWORK' ? 'wifi-off' : 'cloud-alert-outline'} tone="danger" />
      <Txt variant="body" style={{ textAlign: 'center' }}>
        {MESSAGES[code] ?? formatError(error)}
      </Txt>
      <Txt
        variant="caption"
        color="textMuted"
        style={{ textAlign: 'center' }}
        testID="error-detail"
        selectable
      >
        {code}: {formatError(error).slice(0, 160)}
      </Txt>
      {onRetry ? <Button label="Riprova" icon="refresh" kind="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <StateIcon name={icon} tone="muted" />
      <Txt variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {body ? (
        <Txt variant="small" color="textMuted" style={{ textAlign: 'center', maxWidth: 320 }}>
          {body}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

/** Shows cached data when available; full-screen states only when there is nothing to show. */
export function QueryView<T>({
  query,
  children,
  loading,
}: {
  query: { data: T | undefined; error: unknown; isPending: boolean; refetch: () => unknown };
  children: (data: T) => ReactNode;
  loading?: string;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isPending && !query.error) return <Loading {...(loading ? { label: loading } : {})} />;
  return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
}

const styles = StyleSheet.create({
  markedWrap: { alignSelf: 'flex-start', paddingHorizontal: 4 },
  marker: {
    position: 'absolute',
    left: -2,
    right: -6,
    // Covers almost the whole glyph height: the text is dark on the marker in both themes.
    top: '6%',
    bottom: '4%',
    borderRadius: 3,
    transform: [{ rotate: '-1.5deg' }, { skewX: '-8deg' }],
  },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  group: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
  },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 56,
  },
  rowIcon: { width: 24, textAlign: 'center' },
  pill: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: touch.min,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: space.xxxl,
    paddingHorizontal: space.lg,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
});
