import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AccountField, AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { ChoiceGrid, DataBadge, StepProgress, smartUI } from '@/components/farm/SmartFarmUI';
import { colors, spacing, typography } from '@/constants/theme';
import { useFarm } from '@/contexts/FarmContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { farmService } from '@/services/farm';
import { smartFarmService } from '@/services/smartFarm';
import type { FarmType } from '@/types/farm';

const farmTypes=[
  {value:'farm',ar:'حقل مفتوح',en:'Open field'},
  {value:'greenhouse',ar:'بيت محمي',en:'Greenhouse'},
  {value:'home_garden',ar:'حديقة منزلية',en:'Home garden'},
  {value:'rooftop',ar:'سطح',en:'Rooftop'},
] satisfies Array<{value:FarmType;ar:string;en:string}>;
const emirateNames:Record<string,string>={'Abu Dhabi':'أبوظبي','Dubai':'دبي','Sharjah':'الشارقة','Ajman':'عجمان','Umm Al Quwain':'أم القيوين','Ras Al Khaimah':'رأس الخيمة','Fujairah':'الفجيرة'};
const emirates=Object.keys(emirateNames).map(value=>({value,ar:emirateNames[value],en:value}));

export default function FarmSetup(){
  const {language,isRTL}=useLanguage(),{refresh}=useFarm(),ar=language==='ar';
  const [step,setStep]=useState(1),[type,setType]=useState<FarmType>('farm'),[emirate,setEmirate]=useState('Abu Dhabi'),[region,setRegion]=useState(''),[name,setName]=useState(''),[areaMode,setAreaMode]=useState('total'),[area,setArea]=useState(''),[length,setLength]=useState(''),[width,setWidth]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const total=5;
  const valid=useMemo(()=>step===1?!!type:step===2?!!emirate:step===3?!!name.trim():step===4?(areaMode==='total'?Number(area)>0:Number(length)>0&&Number(width)>0):true,[step,type,emirate,name,areaMode,area,length,width]);
  const next=()=>{if(!valid){setError(ar?'أكمل البيانات المطلوبة للمتابعة.':'Complete the required details to continue.');return;}setError('');setStep(value=>Math.min(total,value+1));};
  const back=()=>{setError('');setStep(value=>value-1);};
  const save=async()=>{setBusy(true);setError('');try{const measured=areaMode==='total'?await smartFarmService.area({area:Number(area)}):await smartFarmService.area({mode:'dimensions',length:Number(length),width:Number(width),unit:'m'});const farm=await farmService.createFarm({name:name.trim(),type,emirate,region:region.trim(),area:measured.areaM2,areaUnit:'m2'});await refresh();router.replace({pathname:'/my-farm/plan-crop' as never,params:{farmId:farm.id}});}catch{setError(ar?'تعذر حفظ المزرعة. راجع الاتصال والبيانات.':'Could not save the farm. Check your connection and details.');}finally{setBusy(false);}};
  const content=step===1?<View style={styles.stepBody}><Text style={[smartUI.question,{textAlign:isRTL?'right':'left'}]}>{ar?'أين تزرع؟':'Where do you grow?'}</Text><ChoiceGrid items={farmTypes} value={type} onChange={value=>setType(value as FarmType)}/></View>:step===2?<View style={styles.stepBody}><Text style={[smartUI.question,{textAlign:isRTL?'right':'left'}]}>{ar?'في أي إمارة؟':'Which emirate?'}</Text><ChoiceGrid items={emirates} value={emirate} onChange={setEmirate}/><AccountField label={ar?'المنطقة أو المدينة':'Area or city'} value={region} onChangeText={setRegion} placeholder={ar?'اختياري':'Optional'}/></View>:step===3?<View style={styles.stepBody}><Text style={[smartUI.question,{textAlign:isRTL?'right':'left'}]}>{ar?'ما اسم المزرعة؟':'What is the farm name?'}</Text><AccountField label={ar?'اسم واضح لك':'A name you recognize'} value={name} onChangeText={setName} autoFocus placeholder={ar?'مثال: مزرعة العين':'Example: Al Ain Farm'}/></View>:step===4?<View style={styles.stepBody}><Text style={[smartUI.question,{textAlign:isRTL?'right':'left'}]}>{ar?'ما المساحة؟':'What is the area?'}</Text><ChoiceGrid items={[{value:'total',ar:'المساحة الإجمالية',en:'Total area'},{value:'dimensions',ar:'الطول × العرض',en:'Length × width'}]} value={areaMode} onChange={setAreaMode}/>{areaMode==='total'?<AccountField label={ar?'المساحة بالمتر المربع':'Area in square meters'} value={area} onChangeText={setArea} keyboardType="decimal-pad" ltr/>:<View style={styles.fields}><AccountField label={ar?'الطول بالمتر':'Length in meters'} value={length} onChangeText={setLength} keyboardType="decimal-pad" ltr/><AccountField label={ar?'العرض بالمتر':'Width in meters'} value={width} onChangeText={setWidth} keyboardType="decimal-pad" ltr/></View>}<DataBadge kind="user"/><Text style={[styles.originText,{textAlign:isRTL?'right':'left'}]}>{ar?'سنحسب المساحة من الأرقام التي أدخلتها فقط.':'Area is calculated only from the dimensions you enter.'}</Text></View>:<View style={styles.stepBody}><Text style={[smartUI.question,{textAlign:isRTL?'right':'left'}]}>{ar?'راجع مزرعتك':'Review your farm'}</Text><View style={styles.summary}><Text style={[styles.name,{textAlign:isRTL?'right':'left'}]}>{name}</Text><Text style={[styles.line,{textAlign:isRTL?'right':'left'}]}>{(ar?farmTypes.find(item=>item.value===type)?.ar:farmTypes.find(item=>item.value===type)?.en)} · {ar?emirateNames[emirate]:emirate}</Text><Text style={[styles.line,{textAlign:isRTL?'right':'left'}]}>{areaMode==='total'?`${area} m²`:`${length} × ${width} m`}</Text></View><Notice text={ar?'بعد الحفظ سنفتح مخطط المحصول. لن ينشئ النظام مهام أو مواعيد إلا من بيانات موثّقة.':'After saving, Crop Planner opens. The system will not generate tasks or dates without verified data.'}/></View>;
  return <AccountPage title={ar?'إعداد مزرعتي':'Set up My Farm'}><StepProgress step={step} total={total}/>{content}{error?<Notice error text={error}/>:null}<WizardActions step={step} total={total} ar={ar} busy={busy} onNext={next} onSave={save} onBack={back}/></AccountPage>;
}
function WizardActions({step,total,ar,busy,onNext,onSave,onBack}:{step:number;total:number;ar:boolean;busy:boolean;onNext:()=>void;onSave:()=>void;onBack:()=>void}){return <View style={smartUI.actions}>{step<total?<AppButton label={ar?'متابعة':'Continue'} arrow onPress={onNext}/>:<AppButton disabled={busy} label={busy?(ar?'جارٍ الحفظ...':'Saving...'):(ar?'حفظ وبدء التخطيط':'Save and plan a crop')} onPress={onSave}/>}{step>1?<AppButton secondary label={ar?'رجوع':'Back'} onPress={onBack}/>:null}</View>}
const styles=StyleSheet.create({stepBody:{gap:spacing.md},fields:{gap:spacing.sm},originText:{...typography.secondary,color:colors.muted},summary:{backgroundColor:colors.surface,padding:spacing.lg,gap:spacing.sm},name:{...typography.section,color:colors.text},line:{...typography.body,color:colors.muted}});
