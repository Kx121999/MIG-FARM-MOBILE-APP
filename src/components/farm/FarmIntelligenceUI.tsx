import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, BadgeCheck, ChevronLeft, ChevronRight, CircleHelp, CloudOff, Database, Droplets, ExternalLink, Leaf, RadioTower } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CropDigitalState, FarmDecisionCard, FarmIntelligenceRisk, IntelligenceConfidence, IntelligenceProviderStatus, VerifiedKnowledgeSource } from '@/types/farm';

const severityStyle={critical:{color:colors.danger,background:'#FCEAE6'},high:{color:'#9A6510',background:'#FFF4D9'},medium:{color:colors.primary,background:colors.primarySoft},low:{color:colors.muted,background:colors.surfaceMuted}};
const confidenceCopy={HIGH:{ar:'ثقة عالية',en:'High confidence'},MEDIUM:{ar:'ثقة متوسطة',en:'Medium confidence'},LOW:{ar:'ثقة منخفضة',en:'Low confidence'},INSUFFICIENT_DATA:{ar:'بيانات غير كافية',en:'Insufficient data'}};

export function IntelligencePill({confidence}:{confidence:IntelligenceConfidence}){
  const {language}=useLanguage(),copy=confidenceCopy[confidence.level];
  return <View style={[styles.pill,confidence.level==='INSUFFICIENT_DATA'&&styles.pillMuted]}><Text style={[styles.pillText,confidence.level==='INSUFFICIENT_DATA'&&styles.muted]}>{language==='ar'?copy.ar:copy.en}</Text></View>;
}

export function RiskCard({risk,onPress}:{risk:FarmIntelligenceRisk;onPress?:()=>void}){
  const {language,isRTL}=useLanguage(),ar=language==='ar',Arrow=isRTL?ChevronLeft:ChevronRight;
  const Icon=risk.riskType==='IRRIGATION'?Droplets:risk.riskType==='SENSOR'?RadioTower:risk.riskType==='DATA_QUALITY'?Database:AlertTriangle;
  const tone=severityStyle[risk.severity];
  const content=<><View style={[styles.icon,{backgroundColor:tone.background}]}><Icon size={19} color={tone.color}/></View><View style={styles.copy}><View style={[styles.titleLine,{flexDirection:isRTL?'row-reverse':'row'}]}><Text numberOfLines={2} style={[styles.title,{textAlign:isRTL?'right':'left'}]}>{ar?risk.titleAr:risk.titleEn}</Text><View style={[styles.severity,{backgroundColor:tone.background}]}><Text style={[styles.severityText,{color:tone.color}]}>{risk.severity.toUpperCase()}</Text></View></View><Text numberOfLines={3} style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{ar?risk.reasonAr:risk.reasonEn}</Text><IntelligencePill confidence={risk.confidence}/></View>{onPress?<Arrow size={18} color={colors.muted}/>:null}</>;
  return onPress?<MotionPressable accessibilityRole="button" accessibilityLabel={ar?risk.titleAr:risk.titleEn} onPress={onPress} style={[styles.card,{flexDirection:isRTL?'row-reverse':'row'}]}>{content}</MotionPressable>:<View style={[styles.card,{flexDirection:isRTL?'row-reverse':'row'}]}>{content}</View>;
}

export function DecisionCard({item}:{item:FarmDecisionCard}){
  const {isRTL}=useLanguage();
  return <View style={styles.decision}><Text style={[styles.decisionWhat,{textAlign:isRTL?'right':'left'}]}>{item.what}</Text><LabelValue label={isRTL?'لماذا':'Why'} value={item.why} rtl={isRTL}/><LabelValue label={isRTL?'الإجراء':'Action'} value={item.do} rtl={isRTL}/><LabelValue label={isRTL?'المراجعة':'Recheck'} value={item.recheck} rtl={isRTL}/></View>;
}

export function CropStateCard({state,onPress}:{state:CropDigitalState;onPress:()=>void}){
  const {language,isRTL}=useLanguage(),ar=language==='ar',Arrow=isRTL?ChevronLeft:ChevronRight;
  const verified=state.verifiedKnowledgeAvailability.status==='verified_available';
  return <MotionPressable accessibilityRole="button" accessibilityLabel={state.crop} onPress={onPress} style={styles.cropCard}>
    <View style={[styles.cropTop,{flexDirection:isRTL?'row-reverse':'row'}]}><View style={styles.cropIcon}><Leaf size={20} color={colors.primary}/></View><View style={styles.copy}><Text numberOfLines={1} style={[styles.cropName,{textAlign:isRTL?'right':'left'}]}>{state.crop}</Text><Text numberOfLines={1} style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{state.variety||`${state.ageDays??'-'} ${ar?'يوم':'days'}`}</Text></View><Arrow size={18} color={colors.muted}/></View>
    <View style={[styles.cropFacts,{flexDirection:isRTL?'row-reverse':'row'}]}><MiniFact label={ar?'المخاطر':'Risks'} value={String(state.riskFlags.length)}/><MiniFact label={ar?'البيانات':'Data'} value={state.dataCompleteness.status==='good'?(ar?'مكتملة':'Ready'):(ar?'ناقصة':'Missing')}/><MiniFact label={ar?'المعرفة':'Knowledge'} value={verified?(ar?'موثقة':'Verified'):(ar?'غير متاحة':'Unavailable')}/></View>
    {state.dataCompleteness.missing.length?<Text numberOfLines={2} style={[styles.missing,{textAlign:isRTL?'right':'left'}]}>{ar?'ينقص: ':'Missing: '}{state.dataCompleteness.missing.join(' · ')}</Text>:null}
  </MotionPressable>;
}

export function ProviderStatusRow({kind,status}:{kind:'weather'|'vision'|'sensor';status:IntelligenceProviderStatus}){
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  const labels={weather:{ar:'الطقس الحي',en:'Live weather'},vision:{ar:'تحليل الصور',en:'Image analysis'},sensor:{ar:'الحساسات',en:'Sensors'}};
  const Icon=kind==='weather'?CloudOff:kind==='vision'?CircleHelp:RadioTower;
  return <View style={[styles.provider,{flexDirection:isRTL?'row-reverse':'row'}]}><Icon size={19} color={status.status==='configured'?colors.primary:colors.muted}/><View style={styles.copy}><Text style={[styles.providerTitle,{textAlign:isRTL?'right':'left'}]}>{ar?labels[kind].ar:labels[kind].en}</Text><Text style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{ar?status.messageAr:status.messageEn}</Text></View><View style={[styles.statusDot,{backgroundColor:status.status==='configured'?colors.success:colors.borderStrong}]}/></View>;
}

export function VerifiedSourceLink({source}:{source:VerifiedKnowledgeSource}){
  const {isRTL}=useLanguage();
  return <MotionPressable accessibilityRole="link" accessibilityLabel={source.title} onPress={()=>void Linking.openURL(source.url)} style={[styles.source,{flexDirection:isRTL?'row-reverse':'row'}]}><BadgeCheck size={17} color={colors.primary}/><View style={styles.copy}><Text numberOfLines={2} style={[styles.providerTitle,{textAlign:isRTL?'right':'left'}]}>{source.title}</Text><Text style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{source.organization} · {source.lastVerifiedAt?.slice(0,10)||source.retrievedAt||''}</Text></View><ExternalLink size={16} color={colors.muted}/></MotionPressable>;
}

function LabelValue({label,value,rtl}:{label:string;value:string;rtl:boolean}){return <View style={styles.labelValue}><Text style={[styles.label,{textAlign:rtl?'right':'left'}]}>{label}</Text><Text style={[styles.body,{textAlign:rtl?'right':'left',color:colors.text}]}>{value}</Text></View>}
function MiniFact({label,value}:{label:string;value:string}){return <View style={styles.fact}><Text numberOfLines={1} style={styles.factValue}>{value}</Text><Text numberOfLines={1} style={styles.factLabel}>{label}</Text></View>}

const styles=StyleSheet.create({
  card:{minHeight:116,backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.md,alignItems:'flex-start',gap:spacing.md},icon:{width:38,height:38,borderRadius:radius.md,alignItems:'center',justifyContent:'center'},copy:{flex:1,minWidth:0,gap:spacing.xs},titleLine:{alignItems:'flex-start',gap:spacing.sm},title:{...typography.button,color:colors.text,flex:1},body:{...typography.secondary,color:colors.muted},severity:{borderRadius:radius.sm,paddingHorizontal:spacing.sm,paddingVertical:2},severityText:{fontSize:10,lineHeight:14,fontWeight:'900'},pill:{alignSelf:'flex-start',borderRadius:radius.pill,backgroundColor:colors.primarySoft,paddingHorizontal:spacing.sm,paddingVertical:2},pillMuted:{backgroundColor:colors.surfaceMuted},pillText:{...typography.caption,color:colors.primary},muted:{color:colors.muted},
  decision:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.lg,gap:spacing.md},decisionWhat:{...typography.section,color:colors.primaryDark},labelValue:{gap:2},label:{...typography.caption,color:colors.muted,fontWeight:'900'},
  cropCard:{width:280,minHeight:154,backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.md,gap:spacing.md},cropTop:{alignItems:'center',gap:spacing.md},cropIcon:{width:40,height:40,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},cropName:{...typography.button,color:colors.text},cropFacts:{gap:spacing.xs},fact:{flex:1,minWidth:0,backgroundColor:colors.surfaceMuted,borderRadius:radius.sm,padding:spacing.sm,alignItems:'center'},factValue:{...typography.caption,color:colors.text,fontWeight:'900'},factLabel:{fontSize:10,lineHeight:14,color:colors.muted},missing:{...typography.caption,color:colors.warning},
  provider:{minHeight:64,alignItems:'center',gap:spacing.md,paddingVertical:spacing.sm},providerTitle:{...typography.button,color:colors.text},statusDot:{width:8,height:8,borderRadius:4},source:{minHeight:64,alignItems:'center',gap:spacing.md,paddingVertical:spacing.sm},
});
