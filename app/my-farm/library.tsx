import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { AccountField, AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { DataBadge, SourcePanel } from '@/components/farm/SmartFarmUI';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { smartFarmService } from '@/services/smartFarm';
import type { CropKnowledgeProfile, UAERegulation } from '@/types/farm';

export default function FarmLibrary(){
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  const [query,setQuery]=useState(''),[crops,setCrops]=useState<CropKnowledgeProfile[]>([]),[regulations,setRegulations]=useState<UAERegulation[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{const [nextCrops,nextRegulations]=await Promise.all([smartFarmService.crops(),smartFarmService.regulations()]);setCrops(nextCrops);setRegulations(nextRegulations);}catch{setError(ar?'تعذر تحميل المكتبة الموثّقة.':'Could not load the verified library.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const search=async()=>{if(query.trim().length<2)return;setLoading(true);setError('');try{const result=await smartFarmService.search(query.trim());setCrops(result.crops);setRegulations(result.regulations);}catch{setError(ar?'تعذر تنفيذ البحث.':'Search could not be completed.');}finally{setLoading(false);}};
  return <AccountPage title={ar?'المكتبة الزراعية':'Growing library'}><View style={[styles.heading,{flexDirection:isRTL?'row-reverse':'row'}]}><Search size={21} color={colors.primary}/><Text style={[styles.intro,{textAlign:isRTL?'right':'left'}]}>{ar?'محتوى منشور بعد المراجعة فقط':'Only reviewed, published knowledge'}</Text><DataBadge kind="verified"/></View><AccountField label={ar?'ابحث في المحاصيل والتشريعات':'Search crops and regulations'} value={query} onChangeText={setQuery} returnKeyType="search" onSubmitEditing={search}/><AppButton secondary label={ar?'بحث':'Search'} onPress={search}/>{error?<Notice error text={error}/>:null}{loading?<View style={styles.skeleton}><View/><View/><View/></View>:<><SectionTitle text={ar?'ملفات المحاصيل':'Crop profiles'} rtl={isRTL}/>{crops.length?crops.map(crop=><View key={crop.id} style={styles.item}><Text style={[styles.title,{textAlign:isRTL?'right':'left'}]}>{ar?crop.nameAr:crop.nameEn}</Text>{crop.scientificName?<Text style={[styles.meta,{textAlign:isRTL?'right':'left'}]}>{crop.scientificName}</Text>:null}<Text style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{ar?crop.summaryAr:crop.summaryEn}</Text>{crop.source?<SourcePanel source={crop.source}/>:null}</View>):<Notice text={ar?'لا توجد ملفات محاصيل موثّقة منشورة حاليًا. لن نعرض مسافات أو مواسم غير مراجعة.':'No verified crop profiles are published yet. Unreviewed spacing or seasons will not be shown.'}/>}<SectionTitle text={ar?'تشريعات الإمارات':'UAE regulations'} rtl={isRTL}/>{regulations.map(item=><View key={item.id} style={styles.item}><Text style={[styles.title,{textAlign:isRTL?'right':'left'}]}>{ar?item.titleAr:item.titleEn}</Text><Text style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{ar?item.summaryAr:item.summaryEn}</Text><SourcePanel source={item.source}/></View>)}</>}</AccountPage>;
}
function SectionTitle({text,rtl}:{text:string;rtl:boolean}){return <Text style={[styles.section,{textAlign:rtl?'right':'left'}]}>{text}</Text>}
const styles=StyleSheet.create({heading:{alignItems:'center',gap:spacing.sm,flexWrap:'wrap'},intro:{...typography.body,color:colors.text,flex:1},section:{...typography.section,color:colors.text,marginTop:spacing.lg},item:{backgroundColor:colors.surface,padding:spacing.lg,borderRadius:radius.md,gap:spacing.xs},title:{...typography.section,color:colors.text},meta:{...typography.caption,color:colors.muted,fontStyle:'italic'},body:{...typography.body,color:colors.muted},skeleton:{gap:spacing.sm},});

