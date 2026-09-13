import React, { useState } from 'react';
import { AccountField, AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { DataBadge, ResultPanel, TransparencyNote } from '@/components/farm/SmartFarmUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { smartFarmService } from '@/services/smartFarm';
import type { GreenhouseLayoutResult } from '@/types/farm';

export default function GreenhouseLayout(){
  const {language}=useLanguage(),ar=language==='ar';
  const [length,setLength]=useState(''),[width,setWidth]=useState(''),[bed,setBed]=useState(''),[aisle,setAisle]=useState(''),[result,setResult]=useState<GreenhouseLayoutResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const calculate=async()=>{setBusy(true);setError('');try{const response=await smartFarmService.layout({lengthM:Number(length),widthM:Number(width),bedWidthM:Number(bed),aisleWidthM:Number(aisle)});setResult(response.result);}catch{setResult(null);setError(ar?'الأبعاد لا تكفي لتخطيط مصطبة واحدة أو تحتوي قيمة غير صحيحة.':'The dimensions do not fit one bed or contain an invalid value.');}finally{setBusy(false);}};
  return <AccountPage title={ar?'تخطيط البيت المحمي':'Greenhouse layout'}><DataBadge kind="user"/><TransparencyNote>{ar?'هذا توزيع هندسي مبدئي من أبعادك، وليس مخطط إنشاء أو توصية لمحصول.':'This is a preliminary geometric layout from your dimensions, not a construction plan or crop recommendation.'}</TransparencyNote><AccountField label={ar?'الطول (متر)':'Length (m)'} value={length} onChangeText={setLength} keyboardType="decimal-pad" ltr/><AccountField label={ar?'العرض (متر)':'Width (m)'} value={width} onChangeText={setWidth} keyboardType="decimal-pad" ltr/><AccountField label={ar?'عرض المصطبة (متر)':'Bed width (m)'} value={bed} onChangeText={setBed} keyboardType="decimal-pad" ltr/><AccountField label={ar?'عرض الممر (متر)':'Aisle width (m)'} value={aisle} onChangeText={setAisle} keyboardType="decimal-pad" ltr/>{error?<Notice error text={error}/>:null}<AppButton disabled={busy} label={busy?(ar?'جارٍ الحساب...':'Calculating...'):(ar?'اعرض التخطيط':'Show layout')} onPress={calculate}/>{result?<><ResultPanel title={ar?'عدد المصاطب':'Beds'} value={String(result.bedCount)} detail={ar?`مساحة الزراعة ${result.growingAreaM2} م² · الممرات ${result.circulationAreaM2} م²`:`Growing area ${result.growingAreaM2} m² · circulation ${result.circulationAreaM2} m²`}/></>:null}</AccountPage>;
}
