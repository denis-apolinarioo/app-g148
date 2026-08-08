# App G148

PWA (Next.js + Firebase/Firestore) para a comunidade Geração 148.

## Índices do Firestore

Este projeto **não precisa de nenhum índice composto**. As telas que filtram
por pessoa e mostram por data mais recente (posts/orações do Perfil,
Correio, Desafios) buscam só com `where` e ordenam a lista no próprio
código (ver `ordenarPorCreatedAtDesc` em `lib/firestore-helpers.js`) — assim
não é preciso ir no Console do Firebase criar índice nenhum sempre que uma
tela nova precisar filtrar + ordenar.

Se um dia você adicionar uma consulta nova que combine `where` em um campo
com `orderBy` em outro campo, aí sim vai precisar criar um índice composto
manualmente (Firestore Console → Firestore Database → Índices), ou seguir o
mesmo padrão: buscar só com `where` e ordenar no cliente.
