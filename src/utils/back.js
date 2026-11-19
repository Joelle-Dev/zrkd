// 统一「返回」：有来路就退回去，没有就回 fallback。
// 页面里不要再各写一份 window.history.length 判断。
//
// 注意：不能用 window.history.length —— 直接打开深链时它也会 > 1，
// 退回去会离开 App。Vue Router 会把上一条路由写进 history.state.back，
// 用这个判断才准。

export function makeGoBack(router, fallback = '/') {
  return function goBack() {
    const back = window.history.state?.back;
    if (back) router.back();
    else router.replace(fallback);
  };
}
