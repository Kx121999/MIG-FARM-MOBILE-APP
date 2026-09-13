import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { BadgeCheck, Calculator, ExternalLink, FileQuestion, UserRound } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import type { KnowledgeSource } from '@/types/farm';

export function StepProgress({step,total}:{step:number;total:number}) {
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  return <View style={styles.progressWrap} accessibilityLabel={ar?`الخطوة ${step} من ${total}`:`Step ${step} of ${total}`}>
    <View style={[styles.progressTrack,{alignItems:isRTL?'flex-end':'flex-start'}]}><View style={[styles.progressFill,{width:`${Math.max(0,Math.min(100,(step/total)*100))}%`}]}/></View>
    <Text style={[styles.progressText,{textAlign:isRTL?'right':'left'}]}>{ar?`الخطوة ${step} من ${total}`:`Step ${step} of ${total}`}</Text>
  </View>;
}

export function ChoiceGrid({items,value,onChange}:{items:Array<{value:string;ar:string;en:string}>;value:string;onChange:(value:string)=>void}) {
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  return <View style={[styles.choices,{flexDirection:isRTL?'row-reverse':'row'}]}>{items.map(item=><MotionPressable key={item.value} accessibilityRole="radio" accessibilityState={{checked:value===item.value}} onPress={()=>onChange(item.value)} style={[styles.choice,value===item.value&&styles.choiceActive]}><Text numberOfLines={2} style={[styles.choiceLabel,value===item.value&&styles.choiceLabelActive]}>{ar?item.ar:item.en}</Text></MotionPressable>)}</View>;
}

export function DataBadge({kind}:{kind:'verified'|'calculated'|'user'|'unavailable'}) {
  const {language}=useLanguage(),ar=language==='ar';
  const data={
    verified:{Icon:BadgeCheck,ar:'بيانات موثّقة',en:'Verified data'},
    calculated:{Icon:Calculator,ar:'نتيجة محسوبة',en:'Calculated result'},
    user:{Icon:UserRound,ar:'من بياناتك',en:'Your data'},
    unavailable:{Icon:FileQuestion,ar:'بيانات غير متاحة',en:'Data unavailable'},
  }[kind];
  return <View style={[styles.badge,kind==='unavailable'&&styles.badgeMuted]}><data.Icon size={14} color={kind==='unavailable'?colors.muted:colors.primary}/><Text style={[styles.badgeText,kind==='unavailable'&&{color:colors.muted}]}>{ar?data.ar:data.en}</Text></View>;
}

export function ResultPanel({title,value,detail,kind='calculated'}:{title:string;value:string;detail?:string;kind?:'verified'|'calculated'|'user'|'unavailable'}) {
  const {isRTL}=useLanguage();
  return <View style={styles.result}><DataBadge kind={kind}/><Text style={[styles.resultTitle,{textAlign:isRTL?'right':'left'}]}>{title}</Text><Text style={[styles.resultValue,{textAlign:isRTL?'right':'left'}]}>{value}</Text>{detail?<Text style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{detail}</Text>:null}</View>;
}

export function SourcePanel({source}:{source:KnowledgeSource}) {
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  return <MotionPressable accessibilityRole="link" onPress={()=>void Linking.openURL(source.url)} style={[styles.source,{flexDirection:isRTL?'row-reverse':'row'}]}><BadgeCheck size={19} color={colors.primary}/><View style={{flex:1}}><Text style={[styles.sourceTitle,{textAlign:isRTL?'right':'left'}]}>{ar?source.titleAr:source.titleEn}</Text><Text style={[styles.sourceMeta,{textAlign:isRTL?'right':'left'}]}>{source.authority} · {ar?'رُوجع':'Reviewed'} {new Date(source.reviewedAt).toLocaleDateString(ar?'ar-AE':'en-AE')}</Text></View><ExternalLink size={17} color={colors.muted}/></MotionPressable>;
}

export function TransparencyNote({children}:{children:React.ReactNode}) {
  const {isRTL}=useLanguage();
  return <Text style={[styles.note,{textAlign:isRTL?'right':'left'}]}>{children}</Text>;
}

export const smartUI=StyleSheet.create({
  title:{...typography.page,color:colors.text},
  question:{...typography.section,color:colors.text,marginTop:spacing.sm},
  body:{...typography.body,color:colors.muted},
  actions:{gap:spacing.sm,marginTop:spacing.md},
  fieldRow:{flexDirection:'row',gap:spacing.sm},
});

const styles=StyleSheet.create({
  progressWrap:{gap:spacing.xs,marginBottom:spacing.md},progressTrack:{height:4,borderRadius:2,backgroundColor:colors.border,overflow:'hidden'},progressFill:{height:4,backgroundColor:colors.primary},progressText:{...typography.caption,color:colors.muted},
  choices:{flexWrap:'wrap',gap:spacing.sm},choice:{width:'48%',minHeight:64,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surfaceMuted,alignItems:'center',justifyContent:'center'},choiceActive:{backgroundColor:colors.primary},choiceLabel:{...typography.button,color:colors.text,textAlign:'center'},choiceLabelActive:{color:colors.surface},
  badge:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:spacing.xs,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.pill,backgroundColor:colors.primarySoft},badgeMuted:{backgroundColor:colors.surfaceMuted},badgeText:{...typography.caption,color:colors.primary},
  result:{backgroundColor:colors.surface,padding:spacing.lg,borderRadius:radius.md,gap:spacing.sm},resultTitle:{...typography.caption,color:colors.muted},resultValue:{...typography.page,color:colors.primaryDark},body:{...typography.body,color:colors.muted},
  source:{alignItems:'center',gap:spacing.md,paddingVertical:spacing.md,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},sourceTitle:{...typography.button,color:colors.text},sourceMeta:{...typography.caption,color:colors.muted},note:{...typography.secondary,color:colors.muted,backgroundColor:colors.surfaceMuted,padding:spacing.md,borderRadius:radius.md},
});
