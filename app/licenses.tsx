import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import credits from '@/features/legal/credits.json';
import { useTheme } from '@/theme';

/** 한 Text 에 몰아넣는 패키지 수. 🔴 657줄을 Text 하나에 담으면 측정이 느려지고, 줄마다 View 를 두면 요소가 2천 개가 된다 */
const CHUNK = 60;

type Pkg = { n: string; v: string; l: string; c?: string };

/** 패키지 한 묶음을 줄글로 만든다. 🚫 저작권 줄이 없으면 비운다 — 지어내지 않는다 */
function chunkText(rows: readonly Pkg[]): string {
  return rows.map((p) => `${p.n} ${p.v} · ${p.l}${p.c === undefined ? '' : `\n${p.c}`}`).join('\n\n');
}

/**
 * 오픈소스 라이선스 고지 — `docs/OPEN_SOURCE_NOTICE.md`.
 *
 * 🔴 **MIT·ISC·BSD 는 "저작권 고지와 허가 고지를 사본에 포함하라"를 요구한다.** 이름만 적는 것은 고지가 아니다.
 *    그래서 패키지별 저작권 줄과 **라이선스 종류별 전문**을 둘 다 싣는다.
 *
 * 🔴 **이 화면의 데이터는 생성물이다**(`features/legal/credits.json` · `npm run licenses:build`).
 *    손으로 적으면 의존성 하나 늘린 날 조용히 거짓이 되고, 고지의 거짓은 라이선스 위반이다.
 *    `npm run check:licenses` 가 생성물과 지금 의존 트리를 **바이트로** 대조한다.
 *
 * 🟢 **폰트 절이 없다** — 결정 #13(시스템 폰트)이 예고한 그대로 폰트 항목이 해당 없음이다.
 */
export default function Licenses() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const packages = credits.packages as readonly Pkg[];
  const licenses = credits.licenses as Readonly<Record<string, string>>;

  const chunks: Pkg[][] = [];
  for (let i = 0; i < packages.length; i += CHUNK) chunks.push(packages.slice(i, i + CHUNK) as Pkg[]);

  return (
    <Screen scroll hasHeader>
      <Header title={t('legal.oss')} back />

      <AppText variant="caption" tone="muted">
        {t('legal.ossIntro')}
      </AppText>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
        {t('legal.ossSource')}
      </AppText>

      <AppText variant="label" tone="muted" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        {t('legal.ossPackages', { count: packages.length })}
      </AppText>
      <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
        {t('legal.ossNoCopyright')}
      </AppText>
      {chunks.map((rows, i) => (
        <AppText key={rows[0]?.n ?? i} variant="caption" style={styles.block}>
          {chunkText(rows)}
        </AppText>
      ))}

      <AppText variant="label" tone="muted" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        {t('legal.ossTexts')}
      </AppText>
      {Object.keys(licenses).map((id) => (
        <View key={id} style={{ marginBottom: spacing.lg }}>
          <AppText variant="label">{id}</AppText>
          {/* 🚫 번역하지 않는다 — 라이선스 본문은 원문 그대로다(`PRE_LAUNCH_CHECK` §2.1) */}
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
            {licenses[id]}
          </AppText>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 12 },
});
