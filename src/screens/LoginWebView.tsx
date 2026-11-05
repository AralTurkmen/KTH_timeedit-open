import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useColors } from '../theme';
import { Btn, Field } from '../ui';
import { SNIFF } from './sniffer.ts';

interface Props {
  /** Your university's TimeEdit start page (the one you open in a browser). */
  startUrl: string;
  onFeedFound: (feedUrl: string) => void;
  onCancel: () => void;
}

const looksLikeFeed = (u: string) => /^(https?|webcal):\/\/.+\.ics(\?|$)/i.test(u.trim());

export function LoginWebView({ startUrl, onFeedFound, onCancel }: Props) {
  const c = useColors();
  const [found, setFound] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  const onMessage = (e: WebViewMessageEvent) => {
    const url = e.nativeEvent.data;
    if (looksLikeFeed(url)) setFound(url);
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={[styles.hint, { color: c.text }]}>
        Sign in, open your schedule, then tap "Subscribe" (or copy its link). The app tries to
        spot the calendar link by itself. If it doesn't, paste the link in the box below.
      </Text>
      <WebView
        style={styles.fill}
        source={{ uri: startUrl }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        injectedJavaScript={SNIFF}
        injectedJavaScriptForMainFrameOnly={false}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={(req) => {
          if (looksLikeFeed(req.url)) {
            setFound(req.url);
            return false;
          }
          return true;
        }}
      />
      <Text style={[styles.status, { color: found ? '#16a34a' : c.sub }]}>
        {found ? 'Calendar link detected' : 'Looking for a calendar link…'}
      </Text>
      <View style={styles.pad}>
        <Field
          value={manual}
          onChangeText={setManual}
          placeholder="Or paste the calendar link here"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ marginBottom: 0 }}
        />
      </View>
      <View style={styles.bar}>
        <Btn kind="plain" title="Cancel" onPress={onCancel} />
        <Btn
          title="Use link"
          disabled={!found && !looksLikeFeed(manual)}
          onPress={() => onFeedFound(looksLikeFeed(manual) ? manual.trim() : (found as string))}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hint: { padding: 12, fontSize: 13 },
  status: { paddingHorizontal: 12, paddingTop: 8, fontSize: 12 },
  pad: { paddingHorizontal: 12, paddingTop: 6 },
  bar: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
});
