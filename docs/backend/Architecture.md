# アーキテクチャ

### Web と LINE が別々に存在していた構成（Before）

Web アプリと LINE Bot をそれぞれ別サーバーとして構成しており、
両者が個別にロジックやデータアクセスを持っている状態。

```mermaid
flowchart LR
  WUS["Web User"] --> WCtrl
  LUS["LINE User"] --> LINEctrl

  %% Server (アプリケーション層全体をひとまとめに）
  subgraph Web server["WEB Server "]
    WCtrl["Controller"] --> WUC["Usecase"]
    WUC --> WRP["Repository"]
  end

  %% Server (アプリケーション層全体をひとまとめに）
  subgraph LINE server["LINE Server "]
    LINEctrl["LINE Controller"] --> LUC["Usecase"]
    LUC --> LRP["Repository"]
  end

  LRP --> DB[(Database)]
  WRP --> DB[(Database)]


```

### サーバーを統一し、ロジックを共通化した構成（After）

クリーンアーキテクチャを採用し、Controller のみチャネル別、
Usecase・Repository を 1 つに統一することで、ロジックとデータを一元管理

```mermaid
flowchart LR
  WUS["Web User"] --> WCtrl
  LUS["LINE User"] --> LCtrl

  %% Server (アプリケーション層全体をひとまとめに）
  subgraph server["Server "]
    WCtrl["Web Controller"] --> UC["Usecase"]
    LCtrl["LINE Controller"] --> UC
    UC --> RP["Repository"]
  end

  RP --> DB[(Database)]
```
