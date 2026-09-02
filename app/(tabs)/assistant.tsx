import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  ChevronLeft,
  ChevronRight,
  Droplets,
  FlaskConical,
  ImagePlus,
  RotateCcw,
  Sparkles,
  Sprout,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { sendAIMessage } from '@/services/ai';
import { API_ORIGIN } from '@/services/catalog';
import { AIProductResult, ChatImage, ChatMessage, SelectedProductContext } from '@/types';

const HISTORY_KEY = 'mig_ai_mobile_history_v1';
const STATE_KEY = 'mig_ai_mobile_state_v1';
const SESSION_KEY = 'mig_ai_mobile_session_v1';

function id(prefix = 'm') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeSession() {
  return `mig-app-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanReply(value = '') {
  return value.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim();
}

function absoluteUrl(value?: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`;
}

export default function AssistantScreen() {
  const params = useLocalSearchParams<{ product?: string }>();
  const { language, isRTL, t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationState, setConversationState] = useState<Record<string, unknown>>({});
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<ChatImage[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductContext | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const welcome = useMemo<ChatMessage>(() => ({ id: 'welcome', role: 'assistant', content: t('chatWelcome'), createdAt: 1 }), [t]);
  const visibleMessages = messages.length ? messages : [welcome];

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(HISTORY_KEY),
      AsyncStorage.getItem(STATE_KEY),
      AsyncStorage.getItem(SESSION_KEY),
    ]).then(([storedHistory, storedState, storedSession]) => {
      if (storedHistory) setMessages(JSON.parse(storedHistory));
      if (storedState) setConversationState(JSON.parse(storedState));
      const nextSession = storedSession || makeSession();
      setSessionId(nextSession);
      if (!storedSession) AsyncStorage.setItem(SESSION_KEY, nextSession).catch(() => undefined);
    }).catch(() => setSessionId(makeSession())).finally(() => setHydrated(true));
  }, []);

  useEffect(() => () => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40))).catch(() => undefined);
  }, [messages, hydrated]);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STATE_KEY, JSON.stringify(conversationState)).catch(() => undefined);
  }, [conversationState, hydrated]);

  useEffect(() => {
    if (!params.product) return;
    try {
      const parsed = JSON.parse(params.product) as SelectedProductContext;
      if (parsed?.name) {
        setSelectedProduct(parsed);
        setInput(language === 'ar' ? 'تفاصيل المنتج واستخدامه' : 'Product details and use');
      }
    } catch { /* invalid route data is ignored */ }
  }, [params.product, language]);

  const pickImage = async (camera: boolean) => {
    try {
      if (pendingImages.length >= 4) return;
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(language === 'ar' ? 'إذن الكاميرا مطلوب' : 'Camera permission required');
          return;
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.55, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.55, base64: true, allowsMultipleSelection: true, selectionLimit: Math.max(1, 4 - pendingImages.length) });
      if (result.canceled) return;
      const next = result.assets.flatMap((asset): ChatImage[] => {
        if (!asset.base64) return [];
        const mime = asset.mimeType || 'image/jpeg';
        return [{
          type: 'input_image',
          image_url: `data:${mime};base64,${asset.base64}`,
          detail: 'high',
          client_image_id: `img-${asset.assetId || id('asset')}-${asset.base64.length}`,
          capture_target: camera ? 'camera' : 'gallery',
        }];
      });
      setPendingImages((current) => [...current, ...next].slice(0, 4));
    } catch {
      Alert.alert(t('chatError'));
    }
  };

  const clearChat = () => {
    const nextSession = makeSession();
    setMessages([]);
    setConversationState({});
    setPendingImages([]);
    setSelectedProduct(null);
    setQuickReplies([]);
    setSessionId(nextSession);
    AsyncStorage.multiSet([[HISTORY_KEY, '[]'], [STATE_KEY, '{}'], [SESSION_KEY, nextSession]]).catch(() => undefined);
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (busy || (!text && !pendingImages.length) || !sessionId) return;

    const images = pendingImages;
    const userText = text || (language === 'ar' ? 'حلل الصور المرفقة وساعدني حسب اللي ظاهر فيها.' : 'Analyze the attached images and help me with what is visible.');
    const userMessage: ChatMessage = { id: id('user'), role: 'user', content: userText, createdAt: Date.now(), images: images.map((item) => item.image_url) };
    const history = messages.slice(-12).map((item) => ({ role: item.role, content: item.content }));
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setPendingImages([]);
    setQuickReplies([]);
    setBusy(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await sendAIMessage({
        message: userText,
        session_id: sessionId,
        locale: language,
        history,
        conversation_state: conversationState,
        images,
        selected_product_context: selectedProduct,
      }, controller.signal);

      const reply = cleanReply(response.display_reply || response.reply || (language === 'ar' ? 'ما في رد متاح حاليًا.' : 'No response is available right now.'));
      setMessages((current) => [...current, {
        id: id('assistant'),
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
        results: Array.isArray(response.results) ? response.results : [],
      }]);
      if (response.conversation_state) setConversationState(response.conversation_state);
      if (Array.isArray(response.quick_replies)) setQuickReplies(response.quick_replies.slice(0, 6));
    } catch (reason) {
      const timedOut = reason instanceof Error && reason.name === 'AbortError';
      setMessages((current) => [...current, {
        id: id('error'),
        role: 'assistant',
        content: timedOut
          ? (language === 'ar' ? 'الرد أخد وقت أطول من المتوقع. جرّب تبعت الرسالة مرة ثانية.' : 'The response took too long. Please send your message again.')
          : t('chatError'),
        createdAt: Date.now(),
      }]);
    } finally {
      clearTimeout(timeout);
      setBusy(false);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const renderProduct = (product: AIProductResult) => (
    <Pressable key={`${product.name}-${product.sku || ''}`} style={styles.resultCard} onPress={() => openProductResult(product)}>
      {product.image ? <Image source={{ uri: absoluteUrl(product.image) }} style={styles.resultImage} resizeMode="contain" /> : <View style={styles.resultImage}><Sprout size={24} color={colors.leaf} /></View>}
      <View style={styles.resultCopy}>
        <Text numberOfLines={2} style={[styles.resultName, { textAlign: isRTL ? 'right' : 'left' }]}>{product.name}</Text>
        {!!product.price && <Text style={[styles.resultPrice, { textAlign: isRTL ? 'right' : 'left' }]}>{product.price} {product.currency || 'AED'}</Text>}
        {!!product.availability && <Text numberOfLines={1} style={[styles.resultStock, { textAlign: isRTL ? 'right' : 'left' }]}>{product.availability}</Text>}
      </View>
      {isRTL ? <ChevronLeft size={17} color={colors.primary} /> : <ChevronRight size={17} color={colors.primary} />}
    </Pressable>
  );

  const openProductResult = (product: AIProductResult) => {
    const handle = product.url?.match(/\/products?\/([^/?#]+)/i)?.[1];
    if (handle) router.push({ pathname: '/product/[handle]', params: { handle: decodeURIComponent(handle) } });
    else if (product.url) Linking.openURL(absoluteUrl(product.url));
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = item.role === 'user';
    return (
      <View style={[styles.messageWrap, mine ? styles.mineWrap : styles.assistantWrap]}>
        {!!item.images?.length && <View style={styles.messageImages}>{item.images.map((uri, index) => <Image key={`${item.id}-${index}`} source={{ uri }} style={styles.messageImage} />)}</View>}
        <View style={[styles.bubble, mine ? styles.mine : styles.assistantBubble, !mine && shadow]}>
          {!mine && <View style={styles.aiLabelRow}><Sparkles size={12} color={colors.primary} /><Text style={styles.aiLabel}>MIG FARM AI</Text></View>}
          <Text selectable style={[styles.messageText, mine ? styles.mineText : styles.assistantText, { textAlign: isRTL ? 'right' : 'left' }]}>{item.content}</Text>
        </View>
        {!!item.results?.length && <View style={styles.results}>{item.results.slice(0, 4).map(renderProduct)}</View>}
      </View>
    );
  };

  const starterPrompts: Array<{ icon: LucideIcon; label: string; prompt: string }> = language === 'ar'
    ? [
      { icon: Sprout, label: 'البذور', prompt: 'عايز أختار البذور المناسبة للزراعة' },
      { icon: FlaskConical, label: 'الأسمدة', prompt: 'ساعدني أختار السماد أو المغذي المناسب' },
      { icon: Droplets, label: 'الري', prompt: 'محتاج مساعدة في الري والزراعة المائية' },
      { icon: Wrench, label: 'الأدوات', prompt: 'وريني الأدوات والمعدات المناسبة' },
    ]
    : [
      { icon: Sprout, label: 'Seeds', prompt: 'Help me choose the right seeds' },
      { icon: FlaskConical, label: 'Fertilizers', prompt: 'Help me choose the right fertilizer or nutrient' },
      { icon: Droplets, label: 'Irrigation', prompt: 'I need help with irrigation or hydroponics' },
      { icon: Wrench, label: 'Tools', prompt: 'Show me the right tools and equipment' },
    ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.shell}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={styles.aiAvatar}><Bot size={23} color={colors.sun} strokeWidth={2.2} /><View style={styles.onlineDot} /></View>
          <View style={styles.headerCopy}><Text style={[styles.headerTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'المهندس الزراعي الذكي' : 'AI agricultural engineer'}</Text><Text style={[styles.headerStatus, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'متصل • يفهم الصور والمنتجات' : 'Online • understands images and products'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('clearChat')} style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]} onPress={clearChat}><RotateCcw size={19} color={colors.primary} strokeWidth={2.2} /></Pressable>
        </View>

        {!!selectedProduct && (
          <View style={[styles.selectedProduct, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {!!selectedProduct.image && <Image source={{ uri: selectedProduct.image }} style={styles.selectedImage} resizeMode="contain" />}
            <View style={styles.selectedCopy}><Text style={[styles.selectedLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('selectProduct')}</Text><Text numberOfLines={1} style={[styles.selectedName, { textAlign: isRTL ? 'right' : 'left' }]}>{selectedProduct.name}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove selected product" style={({ pressed }) => pressed && styles.pressed} onPress={() => setSelectedProduct(null)}><X size={19} color={colors.muted} /></Pressable>
          </View>
        )}

        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={!messages.length ? (
            <View style={styles.starters}>
              <Text style={[styles.starterTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{language === 'ar' ? 'ابدأ من القسم اللي يهمك' : 'Start with a department'}</Text>
              <View style={styles.starterGrid}>{starterPrompts.map((item) => { const Icon = item.icon; return <Pressable key={item.label} style={({ pressed }) => [styles.starterCard, pressed && styles.pressed]} onPress={() => send(item.prompt)}><View style={styles.starterIconBox}><Icon size={20} color={colors.primary} strokeWidth={2.1} /></View><Text style={styles.starterLabel}>{item.label}</Text></Pressable>; })}</View>
            </View>
          ) : null}
          ListFooterComponent={busy ? <View style={[styles.typing, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}><View style={styles.typingDots}><Text style={styles.typingDotsText}>•••</Text></View><Text style={styles.typingText}>{t('analyzing')}</Text></View> : null}
        />

        {!!quickReplies.length && <FlatList horizontal data={quickReplies} keyExtractor={(item, index) => `${item}-${index}`} style={styles.quickScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickList} renderItem={({ item }) => <Pressable style={({ pressed }) => [styles.quick, pressed && styles.pressed]} onPress={() => send(item)}><Text style={styles.quickText}>{item}</Text></Pressable>} />}

        {!!pendingImages.length && <View style={styles.previewRow}>{pendingImages.map((item, index) => <View key={item.client_image_id} style={styles.previewWrap}><Image source={{ uri: item.image_url }} style={styles.preview} /><Pressable accessibilityRole="button" accessibilityLabel="Remove image" style={styles.previewRemove} onPress={() => setPendingImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={12} color="#FFFFFF" strokeWidth={2.5} /></Pressable></View>)}</View>}

        <View style={styles.composerWrap}>
          <View style={[styles.composer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('gallery')} disabled={busy} style={({ pressed }) => [styles.attach, pressed && styles.pressed]} onPress={() => pickImage(false)}><ImagePlus size={20} color={colors.primary} strokeWidth={2.1} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('camera')} disabled={busy} style={({ pressed }) => [styles.attach, pressed && styles.pressed]} onPress={() => pickImage(true)}><Camera size={20} color={colors.primary} strokeWidth={2.1} /></Pressable>
            <TextInput
              value={input}
              onChangeText={setInput}
              editable={!busy}
              multiline
              maxLength={2500}
              placeholder={t('chatPlaceholder')}
              placeholderTextColor={colors.muted}
              style={[styles.input, { textAlign: isRTL ? 'right' : 'left' }]}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={busy || (!input.trim() && !pendingImages.length)} style={({ pressed }) => [styles.send, (busy || (!input.trim() && !pendingImages.length)) && styles.sendDisabled, pressed && styles.sendPressed]} onPress={() => send()}>{isRTL ? <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.4} /> : <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} />}</Pressable>
          </View>
          <Text style={styles.disclaimer}>{language === 'ar' ? 'للاستخدام الزراعي الآمن: اتبع ملصق المنتج وتعليمات المختص.' : 'For safe use, follow the product label and specialist guidance.'}</Text>
        </View>
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  shell: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: colors.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  flex: { flex: 1 },
  header: { minHeight: 70, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  aiAvatar: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: '#53C86A', borderWidth: 2, borderColor: '#fff', bottom: -1, right: -1 },
  headerCopy: { flex: 1 },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  headerStatus: { color: colors.primary, fontSize: 10, marginTop: 3, fontWeight: '700' },
  clearButton: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  selectedProduct: { margin: 9, marginBottom: 0, minHeight: 58, padding: 8, borderRadius: radius.md, backgroundColor: '#FFF8E5', borderWidth: 1, borderColor: '#F0D991', alignItems: 'center', gap: 9 },
  selectedImage: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#fff' },
  selectedCopy: { flex: 1 },
  selectedLabel: { color: '#8C6A15', fontSize: 9, fontWeight: '900' },
  selectedName: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 2 },
  messages: { padding: 12, paddingBottom: 16 },
  messageWrap: { marginBottom: 12, maxWidth: '90%' },
  mineWrap: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  assistantWrap: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.xl },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  assistantBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 5 },
  aiLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  aiLabel: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  messageText: { fontSize: 13, lineHeight: 21 },
  mineText: { color: '#fff' },
  assistantText: { color: colors.text },
  messageImages: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 5, marginBottom: 5 },
  messageImage: { width: 78, height: 78, borderRadius: 12, backgroundColor: colors.primarySoft },
  results: { width: 300, maxWidth: '100%', gap: 6, marginTop: 7 },
  resultCard: { minHeight: 76, padding: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultImage: { width: 58, height: 58, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  resultCopy: { flex: 1 },
  resultName: { color: colors.text, fontSize: 11, lineHeight: 16, fontWeight: '800' },
  resultPrice: { color: colors.primary, fontSize: 12, fontWeight: '900', marginTop: 3 },
  resultStock: { color: colors.muted, fontSize: 9, marginTop: 2 },
  starters: { marginBottom: 10 },
  starterTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginVertical: 10 },
  starterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  starterCard: { width: '48.5%', height: 76, padding: 10, borderRadius: radius.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#CEE3D1', justifyContent: 'center' },
  starterIconBox: { width: 30, height: 30, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  starterLabel: { color: colors.primaryDark, fontSize: 11, fontWeight: '800', marginTop: 5 },
  typing: { alignItems: 'center', gap: 8, marginTop: 4 },
  typingDots: { paddingHorizontal: 12, height: 34, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  typingDotsText: { color: colors.primary, fontWeight: '900', letterSpacing: 2 },
  typingText: { color: colors.muted, fontSize: 10 },
  quickScroller: { flexGrow: 0, height: 49 },
  quickList: { paddingHorizontal: 10, paddingVertical: 7, gap: 7 },
  quick: { height: 35, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: '#CDE1D0', backgroundColor: colors.primarySoft, justifyContent: 'center' },
  quickText: { color: colors.primaryDark, fontSize: 10, fontWeight: '800' },
  previewRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 7, gap: 7, backgroundColor: colors.surface },
  previewWrap: { width: 58, height: 58 },
  preview: { width: 58, height: 58, borderRadius: 11, backgroundColor: colors.primarySoft },
  previewRemove: { position: 'absolute', right: -4, top: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  composerWrap: { padding: 9, paddingBottom: 6, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  composer: { minHeight: 50, maxHeight: 118, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.background, alignItems: 'flex-end', padding: 5, gap: 3 },
  attach: { width: 35, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 40, maxHeight: 105, paddingHorizontal: 8, paddingVertical: 10, color: colors.text, fontSize: 13 },
  send: { width: 41, height: 41, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.42 },
  sendPressed: { opacity: 0.8 },
  disclaimer: { color: colors.muted, fontSize: 8, textAlign: 'center', marginTop: 5 },
  pressed: { opacity: 0.68 },
});
