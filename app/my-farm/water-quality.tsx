import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Droplets } from 'lucide-react-native';
import { AccountPage } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { VerifiedSourceLink } from '@/components/farm/FarmIntelligenceUI';
import { DataBadge } from '@/components/farm/SmartFarmUI';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { farmIntelligenceService } from '@/services/farmIntelligence';
import type { WaterQualityReference } from '@/types/farm';

export default function WaterQualityScreen(){
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  const [ec,setEc]=useState(''),[crop,setCrop]=useState(''),[result,setResult]=useState<WaterQualityReference|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const run=async()=>{const value=Number(ec);if(!Number.isFinite(value)||value<0){setError(ar?'أدخل قياس EC صالحًا.':'Enter a valid EC measurement.');return;}setBusy(true);setError('');try{setResult(await farmIntelligenceService.waterQuality({ecDsM:value,crop:crop.trim()||undefined,measuredAt:new Date().toISOString()}));}catch{setError(ar?'تعذرت مقارنة القياس الآن.':'The measurement could not be compared.');}finally{setBusy(false);}};
  return <AccountPage title={ar?'جودة مياه الري':'Irrigation water quality'}>
    <View style={styles.intro}><View style={styles.icon}><Droplets size={24} color={colors.primary}/></View><Text style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{ar?'أدخل قياسك الفعلي. سنقارنه بالمراجع الموثقة المتاحة دون وصف علاج.':'Enter your actual measurement. It will be compared with available verified references without prescribing treatment.'}</Text></View>
    <Field label={ar?'EC للمياه (dS/m)':'Water EC (dS/m)'} value={ec} onChangeText={setEc} rtl={isRTL} keyboardType="decimal-pad"/>
    <Field label={ar?'المحصول بالإنجليزية - اختياري':'Crop in English - optional'} value={crop} onChangeText={setCrop} rtl={isRTL}/>
    <AppButton disabled={busy} label={busy?(ar?'جارٍ المقارنة...':'Comparing...'):(ar?'قارن بالمراجع':'Compare with references')} onPress={run}/>
    {error?<Text style={[styles.error,{textAlign:isRTL?'right':'left'}]}>{error}</Text>:null}
    {result?<View style={styles.result}><DataBadge kind={result.status==='reference_available'?'verified':'unavailable'}/><Text style={[styles.measure,{textAlign:isRTL?'right':'left'}]}>{result.userMeasurement.value} dS/m</Text><Text style={[styles.body,{textAlign:isRTL?'right':'left'}]}>{ar?result.warningAr:result.warningEn}</Text>{result.referenceClasses.concat(result.cropReferences).flatMap((record)=>record.sources).filter((source,index,all)=>all.findIndex((item)=>item.id===source.id)===index).map((source)=><VerifiedSourceLink key={source.id} source={source}/>)}</View>:null}
  </AccountPage>;
}
function Field({label,value,onChangeText,rtl,keyboardType}:{label:string;value:string;onChangeText:(value:string)=>void;rtl:boolean;keyboardType?:'decimal-pad'}){return <View style={styles.field}><Text style={[styles.label,{textAlign:rtl?'right':'left'}]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholderTextColor={colors.muted} style={[styles.input,{textAlign:rtl?'right':'left'}]}/></View>}
const styles=StyleSheet.create({intro:{backgroundColor:colors.primarySoft,borderRadius:radius.md,padding:spacing.md,gap:spacing.md},icon:{width:44,height:44,borderRadius:radius.md,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},body:{...typography.body,color:colors.muted},field:{gap:spacing.xs},label:{...typography.button,color:colors.text},input:{minHeight:48,backgroundColor:colors.surface,borderRadius:radius.md,paddingHorizontal:spacing.md,...typography.body,color:colors.text},error:{...typography.secondary,color:colors.danger},result:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.lg,gap:spacing.md},measure:{...typography.page,color:colors.primaryDark}});
