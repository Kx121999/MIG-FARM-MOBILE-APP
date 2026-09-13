import React, { useState } from 'react';
import { AccountField, AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { DataBadge, ResultPanel, TransparencyNote } from '@/components/farm/SmartFarmUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { smartFarmService } from '@/services/smartFarm';
import type { IrrigationRuntimeResult } from '@/types/farm';

export default function IrrigationPlanner(){
  const {language}=useLanguage(),ar=language==='ar';
  const [volume,setVolume]=useState(''),[flow,setFlow]=useState(''),[count,setCount]=useState(''),[result,setResult]=useState<IrrigationRuntimeResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const calculate=async()=>{setBusy(true);setError('');try{const response=await smartFarmService.irrigation({targetVolumeLiters:Number(volume),emitterFlowLitersPerHour:Number(flow),emitterCount:Number(count)});setResult(response.result);}catch{setResult(null);setError(ar?'راجع الحجم والتدفق وعدد النقاطات.':'Check volume, flow and emitter count.');}finally{setBusy(false);}};
  return <AccountPage title={ar?'حاسبة زمن الري':'Irrigation runtime calculator'}>
    <DataBadge kind="user"/>
    <TransparencyNote>{ar?'أدخل حجم المياه المستهدف وتدفق النقاطة من بيانات نظامك. الحاسبة لا تحدد احتياج المحصول ولا عدد مرات الري.':'Enter the target volume and emitter flow from your system. This calculator does not set crop water demand or irrigation frequency.'}</TransparencyNote>
    <AccountField label={ar?'حجم المياه المستهدف (لتر)':'Target volume (liters)'} value={volume} onChangeText={setVolume} keyboardType="decimal-pad" ltr/>
    <AccountField label={ar?'تدفق النقاطة (لتر/ساعة)':'Emitter flow (L/hour)'} value={flow} onChangeText={setFlow} keyboardType="decimal-pad" ltr/>
    <AccountField label={ar?'عدد النقاطات':'Emitter count'} value={count} onChangeText={setCount} keyboardType="number-pad" ltr/>
    {error?<Notice error text={error}/>:null}
    <AppButton disabled={busy} label={busy?(ar?'جارٍ الحساب...':'Calculating...'):(ar?'احسب زمن التشغيل':'Calculate runtime')} onPress={calculate}/>
    {result?<ResultPanel title={ar?'زمن التشغيل المحسوب':'Calculated runtime'} value={ar?`${result.runtimeMinutes} دقيقة`:`${result.runtimeMinutes} min`} detail={ar?`إجمالي التدفق ${result.totalFlowLitersPerHour} لتر/ساعة`:`Total flow ${result.totalFlowLitersPerHour} L/hour`}/>:null}
  </AccountPage>;
}
