import { PaymentView } from '@/features/public/payment_view';
export default async function Page({params}:{params:Promise<{tenant_slug:string;event_slug:string;registration_code:string}>}){const value=await params;return <PaymentView {...value}/>}
