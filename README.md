# How-To Change The Title Logo

There are easier ways to do this but this is the way i know how to do it.


# Step 1:


-Download the required "replace_logo.js" script and "lossless2_235_857x207.tga" file as well as [GIMP photo editor](https://www.gimp.org/downloads/)


# Step 2:


-Open GIMP and open the "lossless2_235_857x207.tga" file. DO NOT CHANGE THE RESOLUTION OF THE IMAGE

-Replace the current logo with whatever .png file you want by using the erase tool and erasing the current logo.

> NOTE: If you want the logo to have a transparent background, make sure you see the checkered background wherever you want it to be transparent.


# Step 3:


> NOTE: Export the "lossless2_235_857x207.tga" file to a new folder and name it "titlelogo" all lowercase. 

-Export the new .TGA file to a folder named "titlelogo" by going to File>Export As>Export>**Uncheck "Use RLE compression"**>Export

-The file should now be in the folder that you pointed to during export.

-Place the "replace_logo.js" script in the "out" folder in the root of the project and put the "titlelogo" folder in the root of that folder.

This is what the layout should look like:

```
out/
├── build/
├── titlelogo/
│   └── lossless2_235_857x207.tga
├── replace_logo.js
```

# Step 4:


-Edit the "replace_logo.js" script so the Config section has "const ARC_PATH = 'C:/ex/ex/ex/ex/Minecraft.Client/Common/Media/MediaWindows64.arc';" and "const OUT_ARC  = 'C:/ex/ex/ex/ex/Minecraft.Client/Common/Media/MediaWindows64_patched.arc';" set as the actual path to the "MediaWindows64.arc file. Make sure to use / and not \


# Step 5:


-Open command prompt and use the "out" folder as the path by using "cd x:your/path/here/out/" or by opening the "out" folder and typing "cmd" in the top navigation bar.

-When you have the out folder set as the path paste "node replace_logo.js titlelogo/lossless2_235_857x207.tga" without the quotes into the command prompt and you should see text at the bottom saying: 

```
"Done! Patched archive written to:
  x:your/path/here/Minecraft.Client/Common/Media/MediaWindows64_patched.arc

To apply: replace MediaWindows64.arc with MediaWindows64_patched.arc
  copy /Y "x:your/path/here/Minecraft.Client/Common/Media/MediaWindows64_patched.arc" "x:your/path/here/Minecraft.Client/Common/Media/MediaWindows64.arc"
```


# Step 6:


-Navigate to "x:your/path/here/Minecraft.Client/Common/Media/" and find the "MediaWindows64.arc" and "MedaiWindows64_patched.arc" files

-Delete or move the "MediaWindows64.arc" file and replace it with the "MediaWindows64_patched.arc" file by renaming the file to just "MediaWindows64.arc (delete "_patched")

# Additional:


-If you built the app in visual studio then it is likely there is either a debug or release build already in the folder tree. You will also have to replace the "MediaWindows64.arc" file in those as well.

-Navigate to the root folder where the project is located and find the "x64" file.

-Open x64>Common>Media and find the "MediaWindows64.arc" file and replace it with the same one located in "x:your/path/here/Minecraft.Client/Common/Media/" (Copy and Paste it to replace it easily)

> NOTE: If you have both a debug and release build you will have to do this for both debug and release if you want the logo to be in both builds. 
