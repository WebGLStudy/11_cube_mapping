(function(){
    'use strict';

    // 変数
    var gl, canvas;
    var program_scene, program_bg;
    
    var mesh_full_screen;
    var mesh_floor, mesh_box1, mesh_box2, mesh_sphere;
    var wMatrixFloor, wMatrixBox1, wMatrixBox2, wMatrixSphere;

    window.addEventListener('load', function(){
        ////////////////////////////
        // 初期化
        ////////////////////////////
        
        // canvas の初期化
        canvas = document.getElementById('canvas');
        canvas.width = 512;
        canvas.height = 512;

        // WeebGLの初期化(WebGL 2.0)
        gl = canvas.getContext('webgl2');
        
        ////////////////////////////
        // プログラムオブジェクトの初期化
        
        // シーン描画用シェーダ
        var vsSourceScene = [
            '#version 300 es',
            'in vec3 position;',
            'in vec3 color;',
            'in vec3 normal;',
            
            'uniform mat4 mwMatrix;',
            'uniform mat4 mpvMatrix;',
            
            'out vec3 vColor;',
            'out vec3 vNormal;',
            'out vec3 vPosition;',

            'void main(void) {',
                'vec4 wpos = mwMatrix * vec4(position, 1.0);',
                'gl_Position = mpvMatrix * wpos;',
                'vPosition = wpos.xyz;',
                'vColor = color;',
                'vNormal = (mwMatrix * vec4(normal, 0.0)).xyz;',
            '}'
        ].join('\n');

        var fsSourceScene = [
            '#version 300 es',
            'precision highp float;',
            'in vec3 vColor;',
            'in vec3 vNormal;',
            'in vec3 vPosition;',
            
            'uniform vec3 camera_pos;',
            'uniform samplerCube cubeTexture;',

            'out vec4 outColor;',

            'void main(void) {',

                'vec3 light_dir = normalize(vec3(1,1,1));',
                'vec3 view_dir = normalize(camera_pos - vPosition);',
                'vec3 normal = normalize(vNormal);',

                'float ln = max(dot(normal, light_dir), 0.0);',
                'vec3 diffuse = vColor.rgb * (0.2 + ln * 0.6);',

                'vec3 r = reflect(-view_dir, normal);',
                'float specular = 0.8 * pow(max(dot(r,light_dir),0.0), 30.0);',
                
                'float f0 = 0.3;',
                'float f = f0 + (1.0 - f0) * pow(1.0-dot(view_dir, normal), 5.0);', // フレネル項
                'vec3 envColor  = f * texture(cubeTexture, r * vec3(-1,1,1)).rgb;',// (-1,1,1)はテクスチャの反転

                'outColor = vec4(diffuse.rgb + specular + envColor, 1.0);',
            '}'
        ].join('\n');

        // 背景用シェーダ
        var vsSourceBg = [
            '#version 300 es',
            'in vec3 position;',
            
            'uniform mat4 mpvMatrixInv;',// ビュー射影行列の逆行列

            'out vec4 vPos;',

            'void main(void) {',
                'gl_Position = vec4(position, 1.0);',
                'vPos = mpvMatrixInv * gl_Position;',// クリップ空間からワールド空間の座標を導出
            '}'
        ].join('\n');

        var fsSourceBg = [
            '#version 300 es',
            'precision highp float;',
            
            'in vec4 vPos;',
            
            'uniform vec3 camera_pos;',
            'uniform samplerCube cubeTexture;',

            'out vec4 outColor;',

            'void main(void) {',
                'vec3 eye_dir = (vPos.xyz/vPos.w - camera_pos) * vec3(-1,1,1);',// (-1,1,1)はテクスチャの反転
                'outColor  = vec4(texture(cubeTexture, eye_dir).rgb, 1.0);',
            '}'
        ].join('\n');

        // シェーダ「プログラム」の初期化
        program_scene = create_program(vsSourceScene, fsSourceScene, ['mwMatrix', 'mpvMatrix', 'camera_pos', 'cubeTexture']);
        program_bg = create_program(vsSourceBg, fsSourceBg, ['mpvMatrixInv', 'camera_pos', 'cubeTexture']);

        ////////////////////////////
        // キューブマップの読み込み
        var envMap = {tex:null};
        
//        create_cube_texture(['img/posx.png', 'img/negx.png', 'img/posy.png', 'img/negy.png', 'img/posz.png', 'img/negz.png'], envMap);
        create_cube_texture([
            'Yokohama3/posx.jpg',
            'Yokohama3/negx.jpg',
            'Yokohama3/posy.jpg',
            'Yokohama3/negy.jpg',
            'Yokohama3/posz.jpg',
            'Yokohama3/negz.jpg'],
            envMap);

        ////////////////////////////
        // モデルの構築
        // 床
        var vertex_data_floor = [
         // x     y     z      R    G    B   normal
          +5.0, -1.0, +5.0,   0.5, 0.5, 0.5, 0,1,0,
          +5.0, -1.0, -5.0,   0.5, 0.5, 0.5, 0,1,0,
          -5.0, -1.0, +5.0,   0.5, 0.5, 0.5, 0,1,0,
          -5.0, -1.0, -5.0,   0.5, 0.5, 0.5, 0,1,0,
        ];
        var index_data_floor = [
          0,  1,  2,   3,  2,  1,
        ];
        mesh_floor = createMesh(gl, program_scene.prg, vertex_data_floor, index_data_floor);

        var vertex_data_box1 = [
         // x     y     z     R   G   B     nx   ny   nz
          -1.0, -1.0, -1.0,  1.0,  0,  0, -1.0, 0.0, 0.0,// 面0
          -1.0, -1.0, +1.0,  1.0,  0,  0, -1.0, 0.0, 0.0,
          -1.0, +1.0, -1.0,  1.0,  0,  0, -1.0, 0.0, 0.0,
          -1.0, +1.0, +1.0,  1.0,  0,  0, -1.0, 0.0, 0.0,
          -1.0, -1.0, -1.0,    0,1.0,  0,  0.0,-1.0, 0.0,// 面1
          +1.0, -1.0, -1.0,    0,1.0,  0,  0.0,-1.0, 0.0,
          -1.0, -1.0, +1.0,    0,1.0,  0,  0.0,-1.0, 0.0,
          +1.0, -1.0, +1.0,    0,1.0,  0,  0.0,-1.0, 0.0,
          -1.0, -1.0, -1.0,    0,  0,1.0,  0.0, 0.0,-1.0,// 面2
          -1.0, +1.0, -1.0,    0,  0,1.0,  0.0, 0.0,-1.0,
          +1.0, -1.0, -1.0,    0,  0,1.0,  0.0, 0.0,-1.0,
          +1.0, +1.0, -1.0,    0,  0,1.0,  0.0, 0.0,-1.0,
          +1.0, -1.0, -1.0,  0.0,1.0,1.0, +1.0, 0.0, 0.0,// 面3
          +1.0, +1.0, -1.0,  0.0,1.0,1.0, +1.0, 0.0, 0.0,
          +1.0, -1.0, +1.0,  0.0,1.0,1.0, +1.0, 0.0, 0.0,
          +1.0, +1.0, +1.0,  0.0,1.0,1.0, +1.0, 0.0, 0.0,
          -1.0, +1.0, -1.0,  1.0,0.0,1.0,  0.0,+1.0, 0.0,// 面4
          -1.0, +1.0, +1.0,  1.0,0.0,1.0,  0.0,+1.0, 0.0,
          +1.0, +1.0, -1.0,  1.0,0.0,1.0,  0.0,+1.0, 0.0,
          +1.0, +1.0, +1.0,  1.0,0.0,1.0,  0.0,+1.0, 0.0,
          -1.0, -1.0, +1.0,  1.0,1.0,0.0,  0.0, 0.0,+1.0,// 面5
          +1.0, -1.0, +1.0,  1.0,1.0,0.0,  0.0, 0.0,+1.0,
          -1.0, +1.0, +1.0,  1.0,1.0,0.0,  0.0, 0.0,+1.0,
          +1.0, +1.0, +1.0,  1.0,1.0,0.0,  0.0, 0.0,+1.0,
        ];
        var index_data_box1 = [
          0+0,  0+1,  0+2,   0+3,  0+2,  0+1, // 面0
          4+0,  4+1,  4+2,   4+3,  4+2,  4+1, // 面1
          8+0,  8+1,  8+2,   8+3,  8+2,  8+1, // 面2
         12+0, 12+1, 12+2,  12+3, 12+2, 12+1, // 面3
         16+0, 16+1, 16+2,  16+3, 16+2, 16+1, // 面4
         20+0, 20+1, 20+2,  20+3, 20+2, 20+1, // 面5
        ];
        mesh_box1 = createMesh(gl, program_scene.prg, vertex_data_box1, index_data_box1);
        
        var l = 1.0 / Math.sqrt(3.0);
        var vertex_data_box2 = [
         // x     y     z     R    G    B   nx  ny  nz
          -1.0, -1.0, -1.0,  0.0, 0.0, 0.0, -l, -l, -l,
          +1.0, -1.0, -1.0,  1.0, 0.0, 0.0, +l, -l, -l,
          -1.0, +1.0, -1.0,  0.0, 1.0, 0.0, -l, +l, -l,
          -1.0, -1.0, +1.0,  0.0, 0.0, 1.0, -l, -l, +l,
          -1.0, +1.0, +1.0,  0.0, 1.0, 1.0, -l, +l, +l,
          +1.0, -1.0, +1.0,  1.0, 0.0, 1.0, +l, -l, +l,
          +1.0, +1.0, -1.0,  1.0, 1.0, 0.0, +l, +l, -l,
          +1.0, +1.0, +1.0,  1.0, 1.0, 1.0, +l, +l, +l,
        ];   
        var index_data_box2 = [
            3,4,0,2,0,4, // 面0
            5,3,1,0,1,3, // 面1
            2,6,0,1,0,6, // 面2
            7,5,6,1,6,5, // 面3
            4,7,2,6,2,7, // 面4
            3,5,4,7,4,5, // 面5
        ];
        mesh_box2 = createMesh(gl, program_scene.prg, vertex_data_box2, index_data_box2);
        
        // 半径1の球
        var vertex_data_sphere = [];
        var index_data_sphere = [];
        var SPHERE_W = 32, SPHERE_H=16;
        for(var y = 0; y <= SPHERE_H; y++){
            for(var x = 0; x <= SPHERE_W; x++){
                var t_x = 2.0 * Math.PI * x / SPHERE_W;
                var t_y = Math.PI * y / SPHERE_H;
                var fx = Math.sin(t_y) * Math.cos(t_x);
                var fy = Math.sin(t_y) * Math.sin(t_x);
                var fz = Math.cos(t_y);
                vertex_data_sphere.push(fx);// pos
                vertex_data_sphere.push(fy);
                vertex_data_sphere.push(fz);
                vertex_data_sphere.push(0.3);// R
                vertex_data_sphere.push(0.3);// G
                vertex_data_sphere.push(0.3);// B
                vertex_data_sphere.push(fx);// normal
                vertex_data_sphere.push(fy);
                vertex_data_sphere.push(fz);
            }
        }
        for(var y = 0; y < SPHERE_H; y++){
            var id0 = (SPHERE_W + 1) * y;
            var id1 = id0 + (SPHERE_W + 1);
            for(var x = 0; x < SPHERE_W; x++){
                index_data_sphere.push(id0 + 0);
                index_data_sphere.push(id1 + 0);
                index_data_sphere.push(id0 + 1);

                index_data_sphere.push(id1 + 1);
                index_data_sphere.push(id0 + 1);
                index_data_sphere.push(id1 + 0);
                
                id0++;
                id1++;
            }
        }
        mesh_sphere = createMesh(gl, program_scene.prg, vertex_data_sphere, index_data_sphere);

        mesh_full_screen = createPlane(gl, program_bg.prg);
        
        ////////////////////////////
        // 各種行列の事前計算
        var mat = new matIV();// 行列のシステムのオブジェクト

        // シーンの射影行列の生成
        var pMatrix   = mat.identity(mat.create());
        mat.perspective(40, canvas.width / canvas.height, 0.01, 40.0, pMatrix);

        // シーンの情報の設定
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        ////////////////////////////
        // フレームの更新
        ////////////////////////////
        var lastTime = null;
        var angle = 0.0;// 物体を動かす角度

        window.requestAnimationFrame(update);
        
        function update(timestamp){
            ////////////////////////////
            // 動かす
            ////////////////////////////
            // 更新間隔の取得
            var elapsedTime = lastTime ? timestamp - lastTime : 0;
            lastTime = timestamp;

            // カメラを回すパラメータ
            angle += 0.0001 * elapsedTime;
            if(1.0 < angle) angle -= 1.0;
//angle = .5;
            // ワールド行列の生成
            wMatrixFloor = mat.identity(mat.create());
            wMatrixBox1   = mat.identity(mat.create());
            wMatrixBox2   = mat.identity(mat.create());
            wMatrixSphere = mat.identity(mat.create());
            var mtmp1 = mat.create();
            var mtmp2 = mat.create();
            mat.translate(mat.identity(mat.create()), [-0.0, 0.7,-3.0], wMatrixBox1); // 左に移動
            mat.translate(mat.identity(mat.create()), [+0.0, 0.7,+3.0], wMatrixBox2); // 右に移動
            mat.rotate(wMatrixBox1, -0.25 * Math.PI, [0.7, 0.0, -0.7], mtmp1);// 斜めに傾ける
            mat.rotate(wMatrixBox2, -0.25 * Math.PI, [0.7, 0.0, -0.7], mtmp2);// 斜めに傾ける
            mat.rotate(mtmp1, 2.0 * Math.PI* angle, [0.577, 0.577, 0.577], wMatrixBox1);// 回転
            mat.rotate(mtmp2, 2.0 * Math.PI* angle, [0.577, 0.577, 0.577], wMatrixBox2);// 回転

            // ビュー行列の生成
            var camera_pos = [20.0 * Math.cos(2.0 * Math.PI*angle), 4.0, 20.0 * Math.sin(2.0 * Math.PI*angle)];
            var look_at = [0.0, 3.0, 0.0];
            var up = [0.0, 1.0, 0.0];
            var vMatrix = mat.create();
            mat.lookAt(camera_pos, look_at, up, vMatrix);

            // ビュー射影行列の生成
            var pvMatrix = mat.create();
            mat.multiply (pMatrix, vMatrix, pvMatrix);
            
            // ビュー射影行列の逆行列を生成
            var pvMatrixInv = mat.create();
            mat.inverse (pvMatrix, pvMatrixInv);
            
            ////////////////////////////
            // 描画
            ////////////////////////////
            
            // オブジェクト描画
            if(envMap.tex){// キューブマップが読み込まれた後
                // 背景描画(背景のクリアを含む)
                gl.depthFunc(gl.ALWAYS);// テストを常に成功させて強制的に書き込む
                gl.useProgram(program_bg.prg);
                gl.uniformMatrix4fv(program_bg.loc[0], false, pvMatrixInv);// 'pvMatrixInv'
                gl.uniform3f(program_bg.loc[1], camera_pos[0], camera_pos[1], camera_pos[2]);// 'camera_pos'
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, envMap.tex);
                gl.uniform1i(program_bg.loc[2], 0); // 'cubeTexture'
                gl.bindVertexArray(mesh_full_screen.vao);
                gl.drawElements(gl.TRIANGLES, mesh_full_screen.count, gl.UNSIGNED_SHORT, 0);
                gl.depthFunc(gl.LEQUAL);// 通常のテストに戻す
                
                // シーンの描画
                gl.useProgram(program_scene.prg);
                gl.uniformMatrix4fv(program_scene.loc[1], false, pvMatrix); // 'pvMatrix'
                gl.uniform3f(program_scene.loc[2], camera_pos[0], camera_pos[1], camera_pos[2]); // 'camera_pos'
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, envMap.tex);
                gl.uniform1i(program_scene.loc[3], 0);// 'cubeTexture'
                
                draw_mesh(program_scene, wMatrixBox1,   mesh_box1);  // 箱1
                draw_mesh(program_scene, wMatrixBox2,   mesh_box2);  // 箱2
                draw_mesh(program_scene, wMatrixSphere, mesh_sphere);// 球
                draw_mesh(program_scene, wMatrixFloor,  mesh_floor); // 床
            }
            
            ////////////////////////////
            // 次のフレームへの処理
            ////////////////////////////
            gl.useProgram(null);
            gl.flush();
            window.requestAnimationFrame(update);
        }
        
    }, false);

    // シェーダの読み込み
    function load_shader(src, type)
    {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
            alert(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    // プログラムオブジェクトの生成
    function create_program(vsSource, fsSource, uniform_names)
    {
        var prg = gl.createProgram();
        gl.attachShader(prg, load_shader(vsSource, gl.VERTEX_SHADER));
        gl.attachShader(prg, load_shader(fsSource, gl.FRAGMENT_SHADER));
        gl.linkProgram(prg);
        if(!gl.getProgramParameter(prg, gl.LINK_STATUS)){
            alert(gl.getProgramInfoLog(prg));
        }

        var uniLocations = [];
        uniform_names.forEach(function(value){
            uniLocations.push(gl.getUniformLocation(prg, value));
        });
        
        return {prg : prg, loc : uniLocations};
    }

    // キューブマップの生成
    function create_cube_texture(sources, dest)
    {
        // インスタンス用の配列
        var a_img = new Array();
        
        for(var i = 0; i < 6; i++){
            a_img[i] = new cubeMapImage();
            a_img[i].data.src = sources[i]; // ファイル名を指定
        }
        
        // キューブマップ用画像のコンストラクタ
        function cubeMapImage()
        {
            this.data = new Image();
            
            // 読み込まれた後の処理
            this.data.onload = function(){
                this.isLoaded = true; // 読み込んだフラグ
                
                // 全ての画像を読み込んだらキューブマップを生成
                if( a_img[0].data.isLoaded &&
                    a_img[1].data.isLoaded &&
                    a_img[2].data.isLoaded &&
                    a_img[3].data.isLoaded &&
                    a_img[4].data.isLoaded &&
                    a_img[5].data.isLoaded)
                {
                    var tex = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);// キューブマップとしてバインド
                    
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a_img[0].data);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a_img[1].data);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a_img[2].data);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a_img[3].data);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a_img[4].data);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a_img[5].data);
                    
                    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);// ミップマップを生成
                    
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    
                    // テクスチャのバインドを無効化
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                    
                    dest.tex = tex;
                }
            };
        }
    }
    
    // モデル描画
    function draw_mesh(program, wMatrix, mesh)
    {
        // 箱
        gl.uniformMatrix4fv(program.loc[0], false, wMatrix);// ワールド行列
        gl.bindVertexArray(mesh.vao);
        gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);// 16ビット整数
    }
    
    // インデックス付き三角形リストの生成
    function createMesh(gl, program, vertex_data, index_data) {
        var vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        // 頂点バッファ
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertex_data), gl.STATIC_DRAW);

        var posAttr = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(posAttr);
        gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, 4*9, 4*0);

        var colAttr = gl.getAttribLocation(program, 'color');
        gl.enableVertexAttribArray(colAttr);
        gl.vertexAttribPointer(colAttr, 3, gl.FLOAT, false, 4*9, 4*3);

        var nrmAttr = gl.getAttribLocation(program, 'normal');
        gl.enableVertexAttribArray(nrmAttr);
        gl.vertexAttribPointer(nrmAttr, 3, gl.FLOAT, false, 4*9, 4*6);

        // インデックスバッファ
        var indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index_data), gl.STATIC_DRAW);// 16ビット整数

        gl.bindVertexArray(null);

        return {vao : vao, count : index_data.length};
    };

    // 全画面描画用モデルの生成
    function createPlane(gl, program) {
        var vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        var vertex_data = new Float32Array([
         // x    y     z
          -1.0,-1.0, +1.0,
          +3.0,-1.0, +1.0,
          -1.0,+3.0, +1.0,
        ]);

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertex_data, gl.STATIC_DRAW);

        var posAttr = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(posAttr);
        gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, 4*3, 0);

        var index_data = [
          0,  1,  2,
        ];
        var indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index_data), gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        return {vao : vao, count : index_data.length};
    };
})();
