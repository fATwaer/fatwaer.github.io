'use strict';

(function iifeMenu(document, window, undefined) {
	var menuBtn = document.querySelector('.menu__btn');
	var	menu = document.querySelector('.menu__list');

	function toggleMenu() {
		menu.classList.toggle('menu__list--active');
		menu.classList.toggle('menu__list--transition');
		this.classList.toggle('menu__btn--active');
		this.setAttribute(
			'aria-expanded',
			this.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'
		);
	}

	function removeMenuTransition() {
		this.classList.remove('menu__list--transition');
	}

	if (menuBtn && menu) {
		menuBtn.addEventListener('click', toggleMenu, false);
		menu.addEventListener('transitionend', removeMenuTransition, false);
	}
}(document, window));

$(window).scroll(function(){
    var scrollTop = $(document).scrollTop();
    var h2s = $('body').find('h2');
	var lis = $('#TableOfContents li')
    for (var i = 0; i < h2s.length; i++){
        if (scrollTop  + 200 > $(h2s[i]).offset().top) {
            $(lis[i-1]).addClass('toc__done');
			$(lis[i]).addClass('toc__activate');
        } else {
			$(lis[i-1]).removeClass('toc__done');
            $(lis[i]).removeClass('toc__activate');
        }
    }
});

//  $(document).ready(function() {
//     $('body').hide().fadeIn(500);
//     $("a").click(function(e) {
//         e.preventDefault();
//         var $link = $(this).attr("href");
// 		if ($link == window.location) {
// 			return;
// 		}
//         $("body").fadeOut(500,function(){
//           window.location = $link;
//         });
//     });
//  });