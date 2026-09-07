import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, CircleAlert, Clock3, Sprout, type LucideIcon } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import type { FarmProblemStatus, FarmTaskStatus } from '@/types/farm';

export function FarmSection({title,action,onAction,children}:{title:string;action?:string;onAction?:()=>void;children:React.ReactNode}) {
  const {isRTL}=useLanguage();
  return <View style={styles.section}><View style={[styles.heading,{flexDirection:isRTL?'row-reverse':'row'}]}><Text accessibilityRole="header" style={[styles.title,{textAlign:isRTL?'right':'left'}]}>{title}</Text>{action&&onAction?<MotionPressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction}><Text style={styles.action}>{action}</Text></MotionPressable>:null}</View>{children}</View>;
}
export function Fact({value,label,icon:Icon=Sprout}:{value:number|string;label:string;icon?:LucideIcon}) {
  const {isRTL}=useLanguage(); return <View style={[styles.fact,{flexDirection:isRTL?'row-reverse':'row'}]}><Icon size={18} color={colors.primary}/><View style={styles.factCopy}><Text style={[styles.factValue,{textAlign:isRTL?'right':'left'}]}>{value}</Text><Text numberOfLines={1} style={[styles.factLabel,{textAlign:isRTL?'right':'left'}]}>{label}</Text></View></View>;
}
const statusColor=(status:string)=>status==='completed'||status==='resolved'||status==='improving'?colors.success:status==='missed'||status==='action_required'||status==='reopened'?colors.danger:status==='due'||status==='investigating'?colors.warning:colors.muted;
export function StatusPill({status,label}:{status:FarmTaskStatus|FarmProblemStatus;label:string}) { const color=statusColor(status); return <View style={[styles.pill,{borderColor:color}]}><Text style={[styles.pillText,{color}]}>{label}</Text></View>; }
export function FarmRow({icon:Icon=Clock3,title,body,trailing,onPress,style}:{icon?:LucideIcon;title:string;body?:string;trailing?:React.ReactNode;onPress?:()=>void;style?:StyleProp<ViewStyle>}) {
  const {isRTL}=useLanguage(); const content=<><View style={styles.icon}><Icon size={20} color={colors.primary}/></View><View style={styles.rowCopy}><Text numberOfLines={2} style={[styles.rowTitle,{textAlign:isRTL?'right':'left'}]}>{title}</Text>{body?<Text numberOfLines={2} style={[styles.rowBody,{textAlign:isRTL?'right':'left'}]}>{body}</Text>:null}</View>{trailing}</>;
  return onPress?<MotionPressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={[styles.row,{flexDirection:isRTL?'row-reverse':'row'},style]}>{content}</MotionPressable>:<View style={[styles.row,{flexDirection:isRTL?'row-reverse':'row'},style]}>{content}</View>;
}
export function FarmSkeleton(){return <View accessibilityState={{busy:true}} style={styles.skeletonWrap}>{[1,2,3].map(i=><View key={i} style={[styles.skeleton,{width:i===2?'72%':'100%'}]}/>)}</View>}
export const farmUI=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},page:{width:'100%',maxWidth:680,alignSelf:'center',padding:spacing.lg,paddingBottom:96,gap:spacing.md},
  card:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.lg,gap:spacing.sm},
  title:{...typography.page,color:colors.text},body:{...typography.body,color:colors.muted},caption:{...typography.caption,color:colors.muted},label:{...typography.button,color:colors.text},
  line:{flexDirection:'row',alignItems:'center',gap:spacing.sm,flexWrap:'wrap'},
});
const styles=StyleSheet.create({
  section:{gap:spacing.sm,marginTop:spacing.md},heading:{minHeight:36,alignItems:'center',justifyContent:'space-between',gap:spacing.md},title:{...typography.section,color:colors.text,flex:1},action:{...typography.button,color:colors.primary},
  fact:{flex:1,minWidth:132,alignItems:'center',gap:spacing.sm,paddingVertical:spacing.sm},factCopy:{flex:1},factValue:{...typography.section,color:colors.text},factLabel:{...typography.caption,color:colors.muted},
  pill:{minHeight:28,borderWidth:1,borderRadius:radius.pill,paddingHorizontal:10,alignItems:'center',justifyContent:'center'},pillText:{...typography.caption},
  row:{minHeight:64,alignItems:'center',gap:spacing.md,paddingVertical:spacing.md,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},icon:{width:36,height:36,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},rowCopy:{flex:1,gap:2},rowTitle:{...typography.button,color:colors.text},rowBody:{...typography.caption,color:colors.muted},
  skeletonWrap:{gap:spacing.md,paddingVertical:spacing.md},skeleton:{height:72,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
});
