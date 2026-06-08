"use client"

import * as React from "react"
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
} from "@/components/ui/menubar"

export function CanonicalMenubarVariant() {
  const [bookmarksBar, setBookmarksBar] = React.useState(false)
  const [fullUrls, setFullUrls] = React.useState(true)
  const [profile, setProfile] = React.useState("andy")

  return (
    <Menubar>
      {/* File */}
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New Tab
            <MenubarShortcut>⌘T</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            New Window
            <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled>
            New Incognito Window
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Share</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Email link</MenubarItem>
              <MenubarItem>Messages</MenubarItem>
              <MenubarItem>Notes</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem>
            Print…
            <MenubarShortcut>⌘P</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Edit */}
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Undo
            <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Redo
            <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Find</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Search the web</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Find…</MenubarItem>
              <MenubarItem>Find Next</MenubarItem>
              <MenubarItem>Find Previous</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem>Cut</MenubarItem>
          <MenubarItem>Copy</MenubarItem>
          <MenubarItem>Paste</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* View */}
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarCheckboxItem
            checked={bookmarksBar}
            onCheckedChange={setBookmarksBar}
          >
            Always Show Bookmarks Bar
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={fullUrls}
            onCheckedChange={setFullUrls}
          >
            Always Show Full URLs
          </MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarItem>
            Reload
            <MenubarShortcut>⌘R</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled>
            Force Reload
            <MenubarShortcut>⇧⌘R</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Toggle Fullscreen</MenubarItem>
          <MenubarItem>Hide Sidebar</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Profiles */}
      <MenubarMenu>
        <MenubarTrigger>Profiles</MenubarTrigger>
        <MenubarContent>
          <MenubarRadioGroup value={profile} onValueChange={setProfile}>
            <MenubarRadioItem value="andy">Andy</MenubarRadioItem>
            <MenubarRadioItem value="benoit">Benoit</MenubarRadioItem>
            <MenubarRadioItem value="luis">Luis</MenubarRadioItem>
          </MenubarRadioGroup>
          <MenubarSeparator />
          <MenubarItem>Edit…</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Add Profile</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}
