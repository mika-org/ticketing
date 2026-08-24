import { RegistrationWizard } from '@/features/public/registration_wizard';
export default async function Page({params}:{params:Promise<{tenant_slug:string;event_slug:string}>}){const value=await params;return <RegistrationWizard {...value}/>}
