export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import ChildFolder from "@/components/ChildFolder";
import Breadcrumb from "@/lib/Breadcrumb";
import { Separator } from "@/components/ui/separator";

export default function page() {
  return (
    <div>
      <div className="p-4">
        <Breadcrumb CurrentPageName="Breeder Management" />
      </div>
      <Separator />

      {/* <NavigationBar currentLabel='Hatchery' fatherLink='./' fatherLabel=''> */}
      <ChildFolder id={2} />
      {/* 
            <NavigationBar currentLabel='Master and Reports' fatherLink='./' fatherLabel='Hatchery'>
                <Layout /> */}
      {/* </NavigationBar> */}
    </div>
  );
}
