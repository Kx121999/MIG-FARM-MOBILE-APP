import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Droplets, Leaf, ListTodo } from 'lucide-react-native';
import { MotionPressable } from '@/components/Motion';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CropMission, FarmActionPriority, FarmCommandStatus, FarmPriorityAction } from '@/types/farm';

const priorityCopy:Record<FarmActionPriority,{ar:string;en:string;color:string;background:string}> = {
  critical:{ar:'حرج',en:'Critical',color:'#9F2D20',background:'#FCEAE6'},
  high:{ar:'مهم',en:'High',color:'#8B5D10',background:'#FFF4D9'},
  normal:{ar:'اليوم',en:'Today',color:colors.primary,background:colors.primarySoft},
  low:{ar:'لاحقًا',en:'Later',color:colors.muted,background:colors.surfaceMuted},
};
const statusCopy:Record<FarmCommandStatus,{ar:string;en:string;color:string}> = {
  good:{ar:'جيد',en:'Good',color:colors.primary},
  attention:{ar:'يحتاج انتباه',en:'Attention',color:'#A36B10'},
  critical:{ar:'حرج',en:'Critical',color:'#A33224'},
  no_data:{ar:'لا توجد بيانات',en:'No data',color:colors.muted},
};

export function PriorityPill({priority}:{priority:FarmActionPriority}) {
  const {language}=useLanguage(),copy=priorityCopy[priority];
  return <View style={[styles.pill,{backgroundColor:copy.background}]}><Text style={[styles.pillText,{color:copy.color}]}>{language==='ar'?copy.ar:copy.en}</Text></View>;
}

export function FarmStatusPill({status}:{status:FarmCommandStatus}) {
  const {language}=useLanguage(),copy=statusCopy[status];
  return <View style={styles.status}><View style={[styles.dot,{backgroundColor:copy.color}]}/><Text style={[styles.statusText,{color:copy.color}]}>{language==='ar'?copy.ar:copy.en}</Text></View>;
}

export function CommandActionCard({item,onPress,onComplete,busy=false}:{item:FarmPriorityAction;onPress:()=>void;onComplete?:()=>void;busy?:boolean}) {
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  const Icon=item.kind.includes('irrigation')?Droplets:item.kind.includes('problem')?AlertTriangle:item.kind.includes('stage')?Leaf:ListTodo;
  const Arrow=isRTL?ChevronLeft:ChevronRight;
  return <MotionPressable accessibilityRole="button" accessibilityLabel={ar?item.titleAr:item.titleEn} onPress={onPress} style={[styles.action,{flexDirection:isRTL?'row-reverse':'row'}]}>
    <View style={styles.actionIcon}><Icon size={20} color={colors.primary}/></View>
    <View style={styles.copy}><View style={[styles.actionTop,{flexDirection:isRTL?'row-reverse':'row'}]}><Text numberOfLines={2} style={[styles.actionTitle,{textAlign:isRTL?'right':'left'}]}>{ar?item.titleAr:item.titleEn}</Text><PriorityPill priority={item.priority}/></View><Text numberOfLines={2} style={[styles.reason,{textAlign:isRTL?'right':'left'}]}>{ar?item.reasonAr:item.reasonEn}</Text></View>
    {onComplete?<MotionPressable disabled={busy} accessibilityRole="button" accessibilityLabel={ar?'إكمال المهمة':'Complete task'} onPress={onComplete} style={styles.done}><CheckCircle2 size={20} color={colors.surface}/></MotionPressable>:<Arrow size={19} color={colors.muted}/>}
  </MotionPressable>;
}

export function CropMissionCard({mission,onPress}:{mission:CropMission;onPress:()=>void}) {
  const {language,isRTL}=useLanguage(),ar=language==='ar',Arrow=isRTL?ChevronLeft:ChevronRight;
  const stage=mission.stage.confirmed?.key || mission.stage.expected?.[ar?'nameAr':'nameEn'] || mission.crop.growthStage.replace('_',' ');
  return <MotionPressable accessibilityRole="button" accessibilityLabel={mission.crop.cropName} onPress={onPress} style={styles.mission}>
    <View style={[styles.missionTop,{flexDirection:isRTL?'row-reverse':'row'}]}><View style={styles.cropIcon}><Leaf size={21} color={colors.primary}/></View><View style={styles.copy}><Text numberOfLines={1} style={[styles.cropName,{textAlign:isRTL?'right':'left'}]}>{mission.crop.cropName}</Text><Text numberOfLines={1} style={[styles.reason,{textAlign:isRTL?'right':'left'}]}>{[mission.crop.variety,mission.zone?.name].filter(Boolean).join(' · ') || mission.farm.name}</Text></View><FarmStatusPill status={mission.status}/><Arrow size={18} color={colors.muted}/></View>
    <View style={[styles.missionFacts,{flexDirection:isRTL?'row-reverse':'row'}]}><MissionFact label={ar?'العمر':'Age'} value={mission.ageDays===null?(ar?'غير متاح':'Unavailable'):(ar?`${mission.ageDays} يوم`:`${mission.ageDays} days`)}/><MissionFact label={ar?'المرحلة':'Stage'} value={String(stage)}/><MissionFact label={ar?'المشاكل':'Problems'} value={String(mission.openProblems.length)}/></View>
    <View style={[styles.next,{flexDirection:isRTL?'row-reverse':'row'}]}><CalendarClock size={16} color={colors.primary}/><Text numberOfLines={2} style={[styles.nextText,{textAlign:isRTL?'right':'left'}]}>{mission.upcomingTask?.title || (mission.stage.next ? `${ar?'التالي':'Next'}: ${ar?mission.stage.next.nameAr:mission.stage.next.nameEn}` : (ar?'لا توجد خطوة موثقة قادمة':'No verified next milestone'))}</Text></View>
  </MotionPressable>;
}

function MissionFact({label,value}:{label:string;value:string}) { return <View style={styles.fact}><Text style={styles.factValue} numberOfLines={1}>{value}</Text><Text style={styles.factLabel}>{label}</Text></View>; }

export function StatusReasonRow({label,status,reason}:{label:string;status:FarmCommandStatus;reason:string}) {
  const {isRTL}=useLanguage();
  return <View style={[styles.statusRow,{flexDirection:isRTL?'row-reverse':'row'}]}><CircleHelp size={18} color={colors.muted}/><View style={styles.copy}><Text style={[styles.statusLabel,{textAlign:isRTL?'right':'left'}]}>{label}</Text><Text style={[styles.reason,{textAlign:isRTL?'right':'left'}]}>{reason}</Text></View><FarmStatusPill status={status}/></View>;
}

const styles=StyleSheet.create({
  pill:{minHeight:24,paddingHorizontal:8,borderRadius:radius.pill,alignItems:'center',justifyContent:'center'},pillText:{...typography.caption,fontWeight:'900'},
  status:{flexDirection:'row',alignItems:'center',gap:5},dot:{width:7,height:7,borderRadius:4},statusText:{...typography.caption,fontWeight:'800'},
  action:{backgroundColor:colors.surface,minHeight:92,borderRadius:radius.md,padding:spacing.md,alignItems:'center',gap:spacing.sm},actionIcon:{width:38,height:38,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},copy:{flex:1,minWidth:0,gap:3},actionTop:{alignItems:'flex-start',gap:spacing.sm},actionTitle:{...typography.button,color:colors.text,flex:1},reason:{...typography.caption,color:colors.muted},done:{width:40,height:40,borderRadius:radius.md,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'},
  mission:{width:292,minHeight:190,backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.lg,gap:spacing.md},missionTop:{alignItems:'center',gap:spacing.sm},cropIcon:{width:40,height:40,borderRadius:radius.md,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},cropName:{...typography.section,color:colors.text},missionFacts:{backgroundColor:colors.surfaceMuted,borderRadius:radius.sm,paddingVertical:spacing.sm},fact:{flex:1,minWidth:0,alignItems:'center',gap:2,paddingHorizontal:4},factValue:{...typography.button,color:colors.text,textAlign:'center'},factLabel:{...typography.caption,color:colors.muted,textAlign:'center'},next:{alignItems:'center',gap:spacing.sm},nextText:{...typography.caption,color:colors.text,flex:1},
  statusRow:{minHeight:72,alignItems:'center',gap:spacing.sm,paddingVertical:spacing.sm},statusLabel:{...typography.button,color:colors.text},
});
