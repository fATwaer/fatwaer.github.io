pushd imgs
rename  ' ' '_'   *
rename  ' ' '_'   *
popd

ls *.md | xargs sed -i 's#\!\[\[#\!\[there is an img](/blog/开源组件/imgs/#g'
ls *.md | xargs sed -i 's#]]#)#g'
ls *.md | xargs sed -i 's#Pasted image #Pasted_image_#g'

