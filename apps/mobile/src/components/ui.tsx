import { MaterialCommunityIcons } from '@expo/vector-icons';
import { errorCode, formatError, highlight } from '@studium/core';
import { Children, type ComponentProps, Fragment, type ReactNode } from 'react';
import {
  ActivityIndicator,
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
import { type Palette, radius, space, type, usePalette } from '@/lib/theme';

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

/** A surface holding rows separated by hairlines. */
export function Group({ children }: { children: ReactNode }) {
  const c = usePalette();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
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
  tone?: 'neutral' | 'success' | 'danger' | 'ink';
}) {
  const c = usePalette();
  const bg = { neutral: c.surfaceAlt, success: c.successSoft, danger: c.dangerSoft, ink: c.inkSoft }[tone];
  const fg = { neutral: c.textMuted, success: c.success, danger: c.danger, ink: c.ink }[tone];
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
  kind?: 'primary' | 'secondary' | 'quiet';
  busy?: boolean;
  testID?: string;
  disabled?: boolean;
}) {
  const c = usePalette();
  const bg = kind === 'primary' ? c.ink : kind === 'secondary' ? c.inkSoft : 'transparent';
  const fg = kind === 'primary' ? c.onInk : c.ink;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: kind === 'primary' ? '#ffffff33' : c.inkSoft }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
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

export function Loading({ label = 'Caricamento…' }: { label?: string }) {
  const c = usePalette();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={c.ink} size="large" />
      <Txt variant="small" color="textMuted">
        {label}
      </Txt>
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
  return (
    <View style={styles.center} testID="error-state">
      <MaterialCommunityIcons name="cloud-alert-outline" size={36} color={usePalette().textMuted} />
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
  const c = usePalette();
  return (
    <View style={styles.center}>
      <MaterialCommunityIcons name={icon} size={40} color={c.textMuted} />
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
  sep: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowIcon: { width: 24, textAlign: 'center' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: 48,
    paddingHorizontal: space.lg,
  },
});
