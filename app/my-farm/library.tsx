import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { AccountField, AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { VerifiedSourceLink } from '@/components/farm/FarmIntelligenceUI';
import { DataBadge } from '@/components/farm/SmartFarmUI';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { farmIntelligenceService } from '@/services/farmIntelligence';
import type { VerifiedKnowledgeRecord } from '@/types/farm';

export default function FarmLibrary(){
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  const [query,setQuery]=useState(''),[items,setItems]=useState<VerifiedKnowledgeRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{const [crops,uae]=await Promise.all([farmIntelligenceService.crops(),farmIntelligenceService.regulations()]);setItems([...crops.items,...uae.items]);}catch{setError(ar?'تعذر تحميل المكتبة الموثقة.':'The verified library could not be loaded.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[ar]);
  const search=async()=>{if(query.trim().length<2)return;setLoading(true);setError('');try{setItems((await farmIntelligenceService.search(query.trim())).items);}catch{setError(ar?'تعذر البحث الآن.':'Search is unavailable right now.');}finally{setLoading(false);}};
  return <AccountPage title={ar?'المكتبة الموثقة':'Verified library'}>
    <View style={[styles.intro,{flexDirection:isRTL?'row-reverse':'row'}]}><Search size={20} color={colors.primary}/><Text style={[styles.introText,{textAlign:isRTL?'right':'left'}]}>{ar?'بحث عربي وإنجليزي داخل بيانات مرتبطة بمصادرها.':'Arabic and English search across source-backed records.'}</Text><DataBadge kind="verified"/></View>
    <AccountField label={ar?'ابحث عن محصول، عرض، مرض، أو خدمة':'Search crops, symptoms, diseases, or services'} value={query} onChangeText={setQuery} onSubmitEditing={search}/>
    <View style={styles.actions}><AppButton label={ar?'بحث':'Search'} onPress={search}/><AppButton secondary label={ar?'عرض البداية':'Reset'} onPress={load}/></View>
    {error?<Notice error text={error}/>:null}
    {loading?<View style={styles.loading}><Text style={styles.body}>{ar?'جار التحقق من السجلات...':'Checking verified records...'}</Text></View>:items.length?<View style={styles.list}>{items.map((item)=><KnowledgeCard key={item.id} item={item} ar={ar} rtl={isRTL}/>)}</View>:<Notice text={ar?'لا توجد نتيجة موثقة مطابقة.':'No matching verified result.'}/>} 
  </AccountPage>;
}

function KnowledgeCard({item,ar,rtl}:{item:VerifiedKnowledgeRecord;ar:boolean;rtl:boolean}){
  const payload=item.payload;
  const title=String(payload[ar?'name_ar':'name_en']||payload[ar?'title_ar':'title_en']||payload.name||payload.title||item.crop||item.id);
  const summary=String(payload[ar?'summary_ar':'summary_en']||payload.summary||payload.description||'');
  return <View style={styles.card}><Text style={[styles.type,{textAlign:rtl?'right':'left'}]}>{item.type.replaceAll('_',' ')}</Text><Text style={[styles.title,{textAlign:rtl?'right':'left'}]}>{title}</Text>{summary?<Text style={[styles.body,{textAlign:rtl?'right':'left'}]}>{summary}</Text>:null}{item.sources.map((source)=><VerifiedSourceLink key={source.id} source={source}/>)}</View>;
}
const styles=StyleSheet.create({intro:{alignItems:'center',gap:spacing.md,backgroundColor:colors.primarySoft,borderRadius:radius.md,padding:spacing.md},introText:{...typography.secondary,color:colors.primaryDark,flex:1},actions:{gap:spacing.sm},loading:{minHeight:160,backgroundColor:colors.surface,borderRadius:radius.md,alignItems:'center',justifyContent:'center'},list:{gap:spacing.sm},card:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.lg,gap:spacing.sm},type:{...typography.caption,color:colors.primary,textTransform:'uppercase'},title:{...typography.section,color:colors.text},body:{...typography.body,color:colors.muted}});
