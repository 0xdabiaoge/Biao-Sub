// BiaoSUB 配置常量
export const API = '/api'
export const VERSION = '1.0.0'

// 默认 Clash 配置头
export const defaultHeader = `mixed-port: 7890
ipv6: true
allow-lan: true
unified-delay: false
tcp-concurrent: true
geodata-mode: true
geox-url:
  geoip: "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat"
  geosite: "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat"
  mmdb: "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country-lite.mmdb"
  asn: "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb"
find-process-mode: strict
global-client-fingerprint: chrome
profile:
  store-selected: true
  store-fake-ip: true
sniffer:
  enable: true
  sniff:
    HTTP:
      ports: [80, 8080-8880]
      override-destination: true
    TLS:
      ports: [443, 8443]
    QUIC:
      ports: [443, 8443]
  skip-domain:
    - "Mijia Cloud"
    - "+.push.apple.com"
tun:
  enable: true
  stack: system
  mtu: 1400
  dns-hijack:
    - "any:53"
    - "tcp://any:53"
  auto-route: true
  auto-redirect: true
  auto-detect-interface: true
dns:
  enable: true
  listen: "0.0.0.0:1053"
  ipv6: true
  respect-rules: true
  enhanced-mode: fake-ip
  fake-ip-range: "198.18.0.1/16"
  fake-ip-filter: 
    - "+.lan"
    - "+.local"
    - "+.msftconnecttest.com"
    - "+.msftncsi.com"
    - "localhost.ptlogin2.qq.com"
    - "localhost.sec.qq.com"
    - "localhost.work.weixin.qq.com"
  default-nameserver:
    - "223.5.5.5"
    - "119.29.29.29"
  nameserver:
    - "https://cloudflare-dns.com/dns-query"
    - "https://dns.google/dns-query"
    - "https://1.1.1.1/dns-query"
    - "https://8.8.8.8/dns-query"
  proxy-server-nameserver:
    - "https://223.5.5.5/dns-query"
    - "https://doh.pub/dns-query"
  nameserver-policy:
    'geosite:cn,private':
      - "https://dns.alidns.com/dns-query"
      - "https://doh.pub/dns-query"`

// 默认规则
export const defaultRules = `rules:
  - GEOIP,lan,DIRECT,no-resolve
  - PROCESS-NAME,XTerminal.exe,DIRECT
  - PROCESS-NAME,Thunder.exe,DIRECT
  - PROCESS-NAME,DownloadSdkServer.exe,DIRECT
  
  # === 自定义直连  ===
  - DOMAIN-SUFFIX,getgrass.io,DIRECT
  - DOMAIN-SUFFIX,grass.io,DIRECT
  - DOMAIN-SUFFIX,tianzecdn.com,DIRECT
  - DOMAIN-SUFFIX,tianzebbs.com,DIRECT
  - DOMAIN-KEYWORD,tianze,DIRECT
  
  # === GEOSITE 规则  ===
  - GEOSITE,github,Proxy
  - GEOSITE,twitter,Proxy
  - GEOSITE,youtube,Proxy
  - GEOSITE,google,Proxy
  - GEOSITE,telegram,Proxy
  - GEOSITE,netflix,Proxy
  - GEOSITE,bilibili,DIRECT
  - GEOSITE,bahamut,Proxy
  - GEOSITE,spotify,Proxy
  - GEOSITE,CN,DIRECT
  - GEOSITE,geolocation-!cn,Proxy
  
  # === GEOIP 规则 ===
  - GEOIP,google,Proxy
  - GEOIP,netflix,Proxy
  - GEOIP,telegram,Proxy
  - GEOIP,twitter,Proxy
  - GEOIP,CN,DIRECT
  - MATCH,Proxy`
