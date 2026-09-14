import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { birthYearRange, passes } from '@/features/auth/age-gate';
import { saveAgeBlock, saveAgePass } from '@/features/auth/age-store';
import { markAgeBlocked, settleAgeGate, useAgeGate } from '@/features/auth/gate-store';
import { CONTACT_EMAIL, PRIVACY_URL } from '@/lib/legal';
import { useTheme } from '@/theme';

/**
 * 연령 게이트 화면 — `docs/AUTH_SYSTEM.md` §1.6 · 결정 #25 · 조각 `AgeGateScreen.tsx` 승계.
 *
 * 🔴 **중립적으로 묻는다.** `만 N세 이상입니다 ☑` 는 무엇을 눌러야 통과하는지 즉시 보여서
 *   FTC 가 요구하는 *neutral age screen* 이 아니다. 출생 **연도**를 고르게 한다.
 * 🔴 **생년은 이 화면 밖으로 나가지 않는다.** 여기서 판정하고 버린다.
 * 🔴 **벽이 아니다.** 닫든 미달이든 저장·복습·실천은 그대로다.
 *
 * 앱 전체를 덮는 **층**이라 라우트가 아니다. `app/_layout.tsx` 가 한 번 그린다.
 */
export function AgeGate() {
  const { t } = useTranslation();
  const { palette, radius, spacing } = useTheme();
  const visible = useAgeGate((s) => s.visible);
  const threshold = useAgeGate((s) => s.threshold);
  const blocked = useAgeGate((s) => s.blocked);
  const [busy, setBusy] = useState(false);

  const thisYear = new Date().getFullYear();
  const { min, max } = birthYearRange(thisYear);
  // 최근 해가 위로 오게 — 아래로 121칸을 스크롤해 자기 해를 찾게 두지 않는다
  const years: number[] = [];
  for (let y = max; y >= min; y -= 1) years.push(y);

  const choose = async (year: number) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!passes(year, thisYear, threshold)) {
        // 🔴 출생연도는 저장하지 않는다. 판정 결과만 남기고 365일 뒤 다시 묻는다(§1.5)
        await saveAgeBlock(threshold);
        markAgeBlocked();
        return;
      }
      await saveAgePass(threshold);
      settleAgeGate(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      // 🔴 edge-to-edge 에서 다른 화면처럼 상태바 밑까지 덮고 Screen 이 인셋 + 16 을 준다(2026-09-14 사용자 지적 · AUTH_SYSTEM §1.6)
      statusBarTranslucent
      navigationBarTranslucent
      // 안드로이드 뒤로가기 = 닫기. 게이트는 앱을 못 쓰게 만드는 문이 아니다
      onRequestClose={() => settleAgeGate(false)}
    >
      <Screen>
        {blocked ? (
          <View style={[styles.blocked, { gap: spacing.md }]}>
            <AppText variant="title">{t('ageGate.blockedTitle')}</AppText>
            <AppText tone="muted">{t('ageGate.blockedBody', { min: threshold })}</AppText>
            {/* 🔴 이 화면에서 가장 중요한 한 줄이다. 없으면 미달자는 앱을 못 쓰는 줄 알고 지운다 */}
            <AppText>{t('ageGate.keepUsing')}</AppText>

            {/* 출구 둘(공용 GLOBAL_DATA_COMPLIANCE §3.5). 문의 기능이 아직 없어서 이메일을 글자로 적는다 */}
            <AppText variant="caption" tone="muted">
              {t('ageGate.contact', { email: CONTACT_EMAIL })}
            </AppText>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8}>
              <AppText variant="label" tone="muted">
                {t('ageGate.privacyLink')}
              </AppText>
            </Pressable>

            <Button label={t('ageGate.backToApp')} onPress={() => settleAgeGate(false)} />
          </View>
        ) : (
          <>
            <View style={{ gap: spacing.sm, paddingBottom: spacing.lg }}>
              <AppText variant="title">{t('ageGate.title')}</AppText>
              {/* 왜 묻는지 그 자리에 적는다. 이유 없이 나이를 묻는 화면이 가장 불쾌하다 */}
              <AppText tone="muted">{t('ageGate.why')}</AppText>
              <AppText variant="caption" tone="muted">
                {t('ageGate.notStored')}
              </AppText>
            </View>

            <ScrollView style={styles.list}>
              {years.map((y) => (
                <Pressable
                  key={y}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void choose(y)}
                  style={({ pressed }) => ({
                    backgroundColor: palette.surface,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    marginBottom: spacing.xs,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <AppText>{t('ageGate.year', { year: y })}</AppText>
                </Pressable>
              ))}
            </ScrollView>

            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => settleAgeGate(false)}
              style={{ marginTop: spacing.sm, marginBottom: spacing.md }}
            />
          </>
        )}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  blocked: { flex: 1, justifyContent: 'center' },
  list: { flex: 1 },
});
