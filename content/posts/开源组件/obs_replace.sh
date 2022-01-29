pushd imgs
rename  ' ' '_'   *
rename  ' ' '_'   *
popd

ls *.md | xargs sed -i 's#\!\[\[#\!\[there is an img](https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/#g'
ls *.md | xargs sed -i 's#]]#)#g'
ls *.md | xargs sed -i 's#Pasted image #Pasted_image_#g'

