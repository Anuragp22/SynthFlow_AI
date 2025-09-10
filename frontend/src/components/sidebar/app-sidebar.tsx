
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu
} from "~/components/ui/sidebar"
import SidebarMenuItems from "./sidebar-menu-items";
// Menu items.


export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
        <SidebarGroupLabel className="text-primary mt-4 mb-12 flex flex-col items-start justify-start px-2 text-3xl font-black tracking-widest uppercase">
            <p>Music</p>
            <p className="text-lg">Generator</p>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
          <SidebarMenuItems />
          </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}