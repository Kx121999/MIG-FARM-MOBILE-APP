import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react-native';
import { router } from 'expo-router';
import { AccountPage, Notice } from '@/components/account/AccountUI';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/ScreenState';
import { FarmRow, FarmSkeleton, StatusPill, farmUI } from '@/components/farm/FarmUI';
import { useLanguage } from '@/contexts/LanguageContext';
import { farmService } from '@/services/farm';
import type { FarmProblem } from '@/types/farm';

const labels:Record<FarmProblem['status'],{ar:string;en:string}>={new:{ar:'جديدة',en:'New'},investigating:{ar:'قيد الفحص',en:'Investigating'},action_required:{ar:'تحتاج إجراء',en:'Action required'},monitoring:{ar:'تحت المتابعة',en:'Monitoring'},improving:{ar:'تتحسن',en:'Improving'},resolved:{ar:'تم حلها',en:'Resolved'},reopened:{ar:'عادت المشكلة',en:'Reopened'}};
export default function Problems(){const {language}=useLanguage(),ar=language==='ar';const [items,setItems]=useState<FarmProblem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');const load=async()=>{setLoading(true);try{setItems(await farmService.problems());setError('');}catch{setError(ar?'تعذر تحميل المشكلات.':'Could not load problems.');}finally{setLoading(false);}};useEffect(()=>{void load();},[]);return <AccountPage title={ar?'مشاكل مزرعتي':'Farm problems'}>{loading?<FarmSkeleton/>:error?<><Notice error text={error}/><AppButton label={ar?'إعادة المحاولة':'Try again'} onPress={load}/></>:items.length?<>{items.map(item=><FarmRow key={item.id} icon={AlertTriangle} title={item.title} body={new Intl.DateTimeFormat(ar?'ar-AE':'en-AE',{day:'numeric',month:'short'}).format(new Date(item.firstObservedAt))} trailing={<StatusPill status={item.status} label={labels[item.status][ar?'ar':'en']}/>} onPress={()=>router.push({pathname:'/my-farm/problem/[id]',params:{id:item.id}})}/>)}</>:<EmptyState icon={AlertTriangle} title={ar?'لا توجد مشكلات مسجلة':'No recorded problems'} body={ar?'سجل ما تلاحظه لتتابع التغير والإجراءات بمرور الوقت.':'Record observations to follow changes and actions over time.'}/>}<AppButton label={ar?'إضافة مشكلة':'Add problem'} onPress={()=>router.push({pathname:'/my-farm/add',params:{type:'problem'}})}/></AccountPage>}
