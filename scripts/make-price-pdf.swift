// Собирает PDF прайс-листа из catalog.html (печатные стили) через WebKit.
// Запуск: swift scripts/make-price-pdf.swift http://localhost:8765/catalog.html?print=0 tms-club-price.pdf
import Cocoa
import WebKit

let args = CommandLine.arguments
let url = URL(string: args.count > 1 ? args[1] : "http://localhost:8765/catalog.html")!
let out = URL(fileURLWithPath: args.count > 2 ? args[2] : "tms-club-price.pdf")

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

final class D: NSObject, WKNavigationDelegate {
  var done = false
  func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
    // ждём рендер таблицы (JS) и шрифты
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
      let info = NSPrintInfo()
      info.paperSize = NSSize(width: 595, height: 842) // A4
      info.topMargin = 28; info.bottomMargin = 28; info.leftMargin = 24; info.rightMargin = 24
      info.horizontalPagination = .fit; info.verticalPagination = .automatic
      info.isHorizontallyCentered = false; info.isVerticallyCentered = false
      info.jobDisposition = .save
      info.dictionary()[NSPrintInfo.AttributeKey.jobSavingURL] = out
      let op = w.printOperation(with: info)
      op.showsPrintPanel = false; op.showsProgressPanel = false
      op.view?.frame = NSRect(x: 0, y: 0, width: 595 - 48, height: 842 - 56)
      op.run()
      self.done = true
    }
  }
  func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { print("FAIL", e); exit(1) }
}

let cfg = WKWebViewConfiguration()
let web = WKWebView(frame: NSRect(x: 0, y: 0, width: 547, height: 786), configuration: cfg)
let d = D()
web.navigationDelegate = d
// печать берёт media=print стили сама; чтобы JS не вызывал window.print(), грузим без ?print=1
web.load(URLRequest(url: url))
let deadline = Date().addingTimeInterval(30)
while !d.done && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.1)) }
RunLoop.main.run(until: Date().addingTimeInterval(1.0))
print(d.done ? "OK \(out.path)" : "TIMEOUT")
