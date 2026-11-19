// 统一「返回」：有来路就退回去，没有就回 fallback。
// 页面里不要再各写一份 window.history.length 判断。

export function makeGoBack(router, fallback = '/') {
  return function goBack() {
    if (window.history.length > 1) router.back();
    else router.replace(fallback);
  };
}
