import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AccountField, AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { DataBadge, ResultPanel, TransparencyNote, smartUI } from '@/components/farm/SmartFarmUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { smartFarmService } from '@/services/smartFarm';
import type { PlantPopulationResult } from '@/types/farm';

export default function PlantingCalculator(){
  const {language,isRTL}=useLanguage(),ar=language==='ar';
  const [area,setArea]=useState(''),[rows,setRows]=useState(''),[plants,setPlants]=useState(''),[perStation,setPerStation]=useState('1'),[result,setResult]=useState<PlantPopulationResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const calculate=async()=>{setBusy(true);setError('');try{const response=await smartFarmService.planting({areaM2:Number(area),rowSpacingCm:Number(rows),plantSpacingCm:Number(plants),plantsPerStation:Number(perStation)});setResult(response.result);}catch{setResult(null);setError(ar?'أدخل أرقامًا صحيحة أكبر من صفر.':'Enter valid numbers greater than zero.');}finally{setBusy(false);}};
  return <AccountPage title={ar?'حاسبة عدد النباتات':'Plant population calculator'}><Text style={[smartUI.body,{textAlign:isRTL?'right':'left'}]}>{ar?'حاسبة رياضية من قياساتك. لا تقترح مسافات زراعية.':'A mathematical calculator using your measurements. It does not recommend spacing.'}</Text><DataBadge kind="user"/><AccountField label={ar?'المساحة بالمتر المربع':'Area (m²)'} value={area} onChangeText={setArea} keyboardType="decimal-pad" ltr/><AccountField label={ar?'المسافة بين الصفوف بالسنتيمتر':'Row spacing (cm)'} value={rows} onChangeText={setRows} keyboardType="decimal-pad" ltr/><AccountField label={ar?'المسافة بين النباتات بالسنتيمتر':'Plant spacing (cm)'} value={plants} onChangeText={setPlants} keyboardType="decimal-pad" ltr/><AccountField label={ar?'عدد النباتات في الجورة':'Plants per station'} value={perStation} onChangeText={setPerStation} keyboardType="number-pad" ltr/>{error?<Notice error text={error}/>:null}<AppButton disabled={busy} label={busy?(ar?'جارٍ الحساب...':'Calculating...'):(ar?'احسب':'Calculate')} onPress={calculate}/>{result?<View style={smartUI.actions}><ResultPanel title={ar?'العدد التقديري':'Estimated population'} value={new Intl.NumberFormat(ar?'ar-AE':'en-AE').format(result.plantCount)} detail={ar?`${result.stationCount} جورة ضمن ${result.usableAreaM2} م²`:`${result.stationCount} stations across ${result.usableAreaM2} m²`}/><TransparencyNote>{ar?'النتيجة تقريبية ومبنية فقط على المساحة والمسافات التي أدخلتها، وليست توصية لمحصول محدد.':'This estimate uses only the area and spacing you entered; it is not a crop-specific recommendation.'}</TransparencyNote></View>:null}</AccountPage>;
}

